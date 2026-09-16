import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Expense, DeletedEntry } from '@kitty/shared-types';
import { assertPayersSum, computeShares, SplitError } from '@kitty/shared-money';
import { DataSource, EntityManager, In, Repository, IsNull, Not } from 'typeorm';
import { AppError } from '../../common/app-error';
import { toExpense } from '../../common/mappers';
import {
  ExpenseEntity, ExpensePayerEntity, ExpenseShareEntity, MemberEntity,
} from '../../entities';
import { ActivityService } from '../activity/activity.service';
import type { CreateExpenseBody, UpdateExpenseBody } from './dto/expense.dto';

export interface ListExpensesQuery {
  categoryId?: string;
  memberId?: string;
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
}

/** UUID v1-v5, matching the `uuid` type of the idempotency_key column. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly activity: ActivityService,
    @InjectRepository(ExpenseEntity) private readonly expenses: Repository<ExpenseEntity>,
    @InjectRepository(MemberEntity) private readonly members: Repository<MemberEntity>,
  ) {}

  /**
   * @description Lists active expenses, newest first, with optional filters.
   * @param query - Category, member (payer or beneficiary), title search, date range and limit.
   */
  async findAll(groupId: string, query: ListExpensesQuery = {}): Promise<Expense[]> {
    const qb = this.expenses
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.payers', 'payer')
      .leftJoinAndSelect('e.shares', 'share')
      .where('e.group_id = :groupId', { groupId })
      .andWhere('e.deleted_at IS NULL');

    if (query.categoryId) qb.andWhere('e.category_id = :cid', { cid: query.categoryId });
    if (query.from) qb.andWhere('e.expense_date >= :from', { from: query.from });
    if (query.to) qb.andWhere('e.expense_date <= :to', { to: query.to });
    if (query.q) qb.andWhere('e.title ILIKE :q', { q: `%${query.q}%` });
    if (query.memberId) {
      // A member is involved if they paid or have a share
      qb.andWhere(
        `EXISTS (SELECT 1 FROM expense_payers ep WHERE ep.expense_id = e.id AND ep.member_id = :mid)
         OR EXISTS (SELECT 1 FROM expense_shares es WHERE es.expense_id = e.id AND es.member_id = :mid)`,
        { mid: query.memberId },
      );
    }

    qb.orderBy('e.expense_date', 'DESC').addOrderBy('e.created_at', 'DESC');
    if (query.limit) qb.take(query.limit);

    return (await qb.getMany()).map(toExpense);
  }

  async findOne(groupId: string, id: string): Promise<Expense> {
    const entity = await this.expenses.findOne({ where: { id, groupId } });
    if (!entity) throw AppError.notFound('EXPENSE_NOT_FOUND', 'Không tìm thấy khoản chi');
    return toExpense(entity);
  }

  /**
   * @description Creates an expense with its payers and shares in one transaction.
   * Idempotent: repeating an `Idempotency-Key` returns the existing expense. The
   * initial lookup alone is racy, so a unique violation on
   * `expenses_idempotency_uk` from a concurrent request also resolves to the
   * stored row instead of a 500.
   * @param idempotencyKey - Client-generated UUID, or null.
   * @throws {AppError} On an invalid key, foreign members, or a split that breaks
   * SUM(payers) === amount or SUM(shares) === amount.
   */
  async create(
    groupId: string,
    actorId: string,
    body: CreateExpenseBody,
    idempotencyKey: string | null,
  ): Promise<Expense> {
    if (idempotencyKey !== null && !UUID_PATTERN.test(idempotencyKey)) {
      // The column is `uuid`; reject malformed keys with 400 before Postgres
      // turns them into a 500.
      throw AppError.badRequest(
        'IDEMPOTENCY_KEY_INVALID',
        'Idempotency-Key phải là UUID',
        { idempotencyKey },
      );
    }

    if (idempotencyKey) {
      const existing = await this.expenses.findOne({ where: { groupId, idempotencyKey } });
      if (existing) return toExpense(existing); // replay, no new row
    }

    await this.assertMembersBelongToGroup(groupId, body);
    const { shares } = this.computeAndValidate(body);

    try {
      return await this.insert(groupId, actorId, body, shares, idempotencyKey);
    } catch (err) {
      // 23505 = unique_violation; here it can only come from
      // `expenses_idempotency_uk`, so a concurrent request already stored it.
      if (idempotencyKey && (err as { code?: string }).code === '23505') {
        const winner = await this.expenses.findOne({ where: { groupId, idempotencyKey } });
        if (winner) return toExpense(winner);
      }
      throw err;
    }
  }

  /** @description Inserts the expense, its payers and shares, and the activity entry atomically. */
  private async insert(
    groupId: string,
    actorId: string,
    body: CreateExpenseBody,
    shares: ReturnType<ExpensesService['computeAndValidate']>['shares'],
    idempotencyKey: string | null,
  ): Promise<Expense> {
    return this.dataSource.transaction(async (manager) => {
      const expense = manager.create(ExpenseEntity, {
        groupId,
        categoryId: body.categoryId ?? null,
        title: body.title.trim(),
        amountMinor: body.amountMinor,
        currency: body.currency.toUpperCase(),
        fxRate: 1, // Single currency per group; no conversion yet
        amountBaseMinor: body.amountMinor,
        splitType: body.splitType,
        expenseDate: body.expenseDate,
        note: body.note ?? null,
        createdByMemberId: actorId,
        receiptId: body.receiptId ?? null,
        idempotencyKey,
      });
      await manager.save(expense);

      await this.writeChildren(manager, expense.id, body, shares);
      await this.activity.log(manager, {
        groupId,
        actorMemberId: actorId,
        action: 'expense.created',
        entityType: 'expense',
        entityId: expense.id,
        snapshot: { title: expense.title, amountMinor: expense.amountMinor },
      });

      const saved = await manager.findOne(ExpenseEntity, { where: { id: expense.id } });
      return toExpense(saved as ExpenseEntity);
    });
  }

  /**
   * @description Updates an expense by deleting and re-inserting its payers and
   * shares in one transaction. Child rows are few, so this is simpler than diffing.
   * @throws {AppError} When the expense is missing or the split is invalid.
   */
  async update(
    groupId: string,
    id: string,
    actorId: string,
    body: UpdateExpenseBody,
  ): Promise<Expense> {
    const entity = await this.expenses.findOne({ where: { id, groupId } });
    if (!entity) throw AppError.notFound('EXPENSE_NOT_FOUND', 'Không tìm thấy khoản chi');

    await this.assertMembersBelongToGroup(groupId, body);
    const { shares } = this.computeAndValidate(body);

    return this.dataSource.transaction(async (manager) => {
      const before = { title: entity.title, amountMinor: entity.amountMinor };

      await manager.delete(ExpensePayerEntity, { expenseId: id });
      await manager.delete(ExpenseShareEntity, { expenseId: id });

      entity.categoryId = body.categoryId ?? null;
      entity.title = body.title.trim();
      entity.amountMinor = body.amountMinor;
      entity.currency = body.currency.toUpperCase();
      entity.amountBaseMinor = body.amountMinor;
      entity.splitType = body.splitType;
      entity.expenseDate = body.expenseDate;
      entity.note = body.note ?? null;
      entity.receiptId = body.receiptId ?? null;
      entity.payers = [];
      entity.shares = [];
      await manager.save(ExpenseEntity, entity);

      await this.writeChildren(manager, id, body, shares);
      await this.activity.log(manager, {
        groupId,
        actorMemberId: actorId,
        action: 'expense.updated',
        entityType: 'expense',
        entityId: id,
        snapshot: { before, after: { title: entity.title, amountMinor: entity.amountMinor } },
      });

      const saved = await manager.findOne(ExpenseEntity, { where: { id } });
      return toExpense(saved as ExpenseEntity);
    });
  }

  /** @description Soft-deletes an expense so it can be restored. */
  async remove(groupId: string, id: string, actorId: string): Promise<void> {
    const entity = await this.expenses.findOne({ where: { id, groupId } });
    if (!entity) throw AppError.notFound('EXPENSE_NOT_FOUND', 'Không tìm thấy khoản chi');

    await this.dataSource.transaction(async (manager) => {
      // softDelete by id, not softRemove(entity): softRemove cascades into
      // payers/shares, which have no deleted_at, and throws
      // MissingDeleteDateColumnError. Child rows are only read through their
      // expense, so hiding the expense hides them too.
      await manager.softDelete(ExpenseEntity, { id: entity.id });
      await this.activity.log(manager, {
        groupId,
        actorMemberId: actorId,
        action: 'expense.deleted',
        entityType: 'expense',
        entityId: id,
        snapshot: { title: entity.title, amountMinor: entity.amountMinor },
      });
    });
  }

  /**
   * @description Lists soft-deleted expenses, most recently deleted first.
   * `withDeleted` also returns live rows, hence the `deletedAt` filter.
   */
  async listDeleted(groupId: string): Promise<DeletedEntry[]> {
    const rows = await this.expenses.find({
      where: { groupId, deletedAt: Not(IsNull()) },
      withDeleted: true,
      order: { deletedAt: 'DESC' },
    });
    return rows.map((e) => ({
      id: e.id,
      kind: 'expense' as const,
      title: e.title,
      amountMinor: Number(e.amountMinor),
      currency: e.currency,
      entryDate: e.expenseDate,
      deletedAt: (e.deletedAt as Date).toISOString(),
    }));
  }

  /** @description Restores a soft-deleted expense. */
  async restore(groupId: string, id: string, actorId: string): Promise<Expense> {
    const entity = await this.expenses.findOne({
      where: { id, groupId },
      withDeleted: true,
    });
    if (!entity) throw AppError.notFound('EXPENSE_NOT_FOUND', 'Không tìm thấy khoản chi');

    await this.dataSource.transaction(async (manager) => {
      // Restore by id; recover(entity) would cascade and fail like softRemove
      await manager.restore(ExpenseEntity, { id });
      await this.activity.log(manager, {
        groupId,
        actorMemberId: actorId,
        action: 'expense.restored',
        entityType: 'expense',
        entityId: id,
      });
    });
    return this.findOne(groupId, id);
  }

  // ───────────────────────── helpers ─────────────────────────

  /**
   * @description Enforces SUM(payers) === amount and computes shares with
   * SUM(shares) === amount, before touching the database.
   * @returns Computed shares in minor units.
   * @throws {AppError} 422 with the SplitError code and details so the client can
   * show a specific message.
   */
  private computeAndValidate(body: CreateExpenseBody) {
    try {
      assertPayersSum(body.amountMinor, body.payers); // SUM(payers) === amount
      const shares = computeShares(body.amountMinor, body.splitType, body.shares); // SUM(shares) === amount
      return { shares };
    } catch (err) {
      if (err instanceof SplitError) {
        throw AppError.unprocessable(err.code, describeSplitError(err), err.details);
      }
      throw err;
    }
  }

  /** @description Inserts payer and share rows for an expense. */
  private async writeChildren(
    manager: EntityManager,
    expenseId: string,
    body: CreateExpenseBody,
    shares: { memberId: string; shareValue: number | null; amountMinor: number }[],
  ): Promise<void> {
    await manager.save(
      body.payers.map((p) =>
        manager.create(ExpensePayerEntity, {
          expenseId,
          memberId: p.memberId,
          amountMinor: p.amountMinor,
        }),
      ),
    );
    await manager.save(
      shares.map((s) =>
        manager.create(ExpenseShareEntity, {
          expenseId,
          memberId: s.memberId,
          shareValue: s.shareValue,
          amountMinor: s.amountMinor,
        }),
      ),
    );
  }

  /** @description Rejects member ids from other groups (prevents IDOR via the request body). */
  private async assertMembersBelongToGroup(
    groupId: string,
    body: CreateExpenseBody,
  ): Promise<void> {
    const ids = [
      ...new Set([...body.payers.map((p) => p.memberId), ...body.shares.map((s) => s.memberId)]),
    ];
    const found = await this.members.find({ where: { id: In(ids), groupId } });
    if (found.length !== ids.length) {
      throw AppError.badRequest(
        'MEMBER_NOT_IN_GROUP',
        'Có thành viên không thuộc nhóm này',
      );
    }
  }
}

/** @description Maps a SplitError to a user-facing Vietnamese message. */
function describeSplitError(err: SplitError): string {
  const d = err.details ?? {};
  switch (err.code) {
    case 'PAYERS_SUM_MISMATCH':
      return `Tổng số tiền đã trả (${d['actual']}) không bằng số tiền khoản chi (${d['expected']})`;
    case 'SHARES_SUM_MISMATCH':
      return `Tổng các phần chia (${d['actual']}) không bằng số tiền (${d['expected']})`;
    case 'PERCENT_SUM_NOT_100':
      return `Tổng phần trăm phải bằng 100, hiện tại là ${d['actual']}`;
    case 'SHARE_VALUE_REQUIRED':
      return 'Thiếu giá trị cho một thành viên';
    case 'SHARES_DUPLICATE_MEMBER':
      return 'Một thành viên xuất hiện hai lần';
    case 'SHARES_EMPTY':
      return 'Phải chọn ít nhất một người được hưởng';
    default:
      return 'Dữ liệu chia tiền không hợp lệ';
  }
}
