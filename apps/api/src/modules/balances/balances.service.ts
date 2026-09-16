import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  Balance, GroupSummary, MemberDetail, Transfer,
} from '@kitty/shared-types';
import { assertBalancesSumToZero, calculateBalances } from '@kitty/shared-money';
import { Repository } from 'typeorm';
import { AppError } from '../../common/app-error';
import { toExpense, toMember, toPayment } from '../../common/mappers';
import {
  ExpenseEntity, GroupEntity, MemberEntity, PaymentEntity,
} from '../../entities';

/**
 * @description Computes balances and summaries on the backend. Balances are
 * derived on every request from expenses and payments, never stored, using the
 * same pure functions from @kitty/shared-money as the frontend.
 */
@Injectable()
export class BalancesService {
  private readonly logger = new Logger(BalancesService.name);

  constructor(
    @InjectRepository(GroupEntity) private readonly groups: Repository<GroupEntity>,
    @InjectRepository(MemberEntity) private readonly members: Repository<MemberEntity>,
    @InjectRepository(ExpenseEntity) private readonly expenses: Repository<ExpenseEntity>,
    @InjectRepository(PaymentEntity) private readonly payments: Repository<PaymentEntity>,
  ) {}

  /** @description Loads the members, expenses and payments needed for balance calculations. */
  private async loadGroupData(groupId: string) {
    const [members, expenseRows, paymentRows] = await Promise.all([
      this.members.find({ where: { groupId }, order: { createdAt: 'ASC', id: 'ASC' } }),
      this.expenses.find({ where: { groupId }, order: { expenseDate: 'DESC' } }),
      this.payments.find({ where: { groupId }, order: { paymentDate: 'DESC' } }),
    ]);
    return {
      members,
      expenses: expenseRows.map(toExpense),
      payments: paymentRows.map(toPayment),
    };
  }

  /**
   * @description Computes each member's net balance. SUM(all balances) must be 0:
   * violations throw outside production and are logged in production.
   */
  async getBalances(groupId: string): Promise<Balance[]> {
    const { members, expenses, payments } = await this.loadGroupData(groupId);
    const balances = calculateBalances(
      members.map((m) => ({ id: m.id })),
      expenses,
      payments,
    );

    // Fail fast outside production so a remainder-distribution bug surfaces
    // on the request that triggers it.
    if (process.env.NODE_ENV !== 'production') {
      assertBalancesSumToZero(balances);
    } else {
      const sum = balances.reduce((s, b) => s + b.balanceMinor, 0);
      if (sum !== 0) this.logger.error(`BALANCE_INVARIANT_VIOLATED group=${groupId} sum=${sum}`);
    }

    return balances;
  }

  /** @description Totals spending overall, per paying member and per category. */
  async getSummary(groupId: string): Promise<GroupSummary> {
    const { members, expenses } = await this.loadGroupData(groupId);

    const totalSpentMinor = expenses.reduce((s, e) => s + e.amountBaseMinor, 0);

    const perMemberMap = new Map(members.map((m) => [m.id, 0]));
    const perCategoryMap = new Map<string | null, number>();

    for (const e of expenses) {
      for (const p of e.payers) {
        perMemberMap.set(p.memberId, (perMemberMap.get(p.memberId) ?? 0) + p.amountMinor);
      }
      perCategoryMap.set(
        e.categoryId,
        (perCategoryMap.get(e.categoryId) ?? 0) + e.amountBaseMinor,
      );
    }

    return {
      totalSpentMinor,
      expenseCount: expenses.length,
      memberCount: members.length,
      perMember: [...perMemberMap].map(([memberId, spentMinor]) => ({ memberId, spentMinor })),
      perCategory: [...perCategoryMap].map(([categoryId, totalMinor]) => ({
        categoryId,
        totalMinor,
      })),
    };
  }

  /** @description Returns a member's balance with the expenses and payments involving them. */
  async getMemberDetail(groupId: string, memberId: string): Promise<MemberDetail> {
    const member = await this.members.findOne({ where: { id: memberId, groupId } });
    if (!member) throw AppError.notFound('MEMBER_NOT_FOUND', 'Không tìm thấy thành viên');

    const { members, expenses, payments } = await this.loadGroupData(groupId);
    const balances = calculateBalances(members.map((m) => ({ id: m.id })), expenses, payments);

    return {
      member: toMember(member),
      balance: balances.find((b) => b.memberId === memberId) as Balance,
      expensesPaid: expenses.filter((e) => e.payers.some((p) => p.memberId === memberId)),
      expensesBenefited: expenses.filter((e) =>
        e.shares.some((s) => s.memberId === memberId && s.amountMinor > 0),
      ),
      payments: payments.filter(
        (p) => p.fromMemberId === memberId || p.toMemberId === memberId,
      ),
    };
  }

  /** @description Returns one member's balance; used to block removing a member who still owes or is owed. */
  async getMemberBalance(groupId: string, memberId: string): Promise<number> {
    const balances = await this.getBalances(groupId);
    return balances.find((b) => b.memberId === memberId)?.balanceMinor ?? 0;
  }
}
