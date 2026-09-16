import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { DeletedEntry, Payment } from '@kitty/shared-types';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { AppError } from '../../common/app-error';
import { toPayment } from '../../common/mappers';
import { MemberEntity, PaymentEntity } from '../../entities';
import { ActivityService } from '../activity/activity.service';
import type { CreatePaymentBody, UpdatePaymentBody } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly activity: ActivityService,
    @InjectRepository(PaymentEntity) private readonly payments: Repository<PaymentEntity>,
    @InjectRepository(MemberEntity) private readonly members: Repository<MemberEntity>,
  ) {}

  async findAll(groupId: string): Promise<Payment[]> {
    const rows = await this.payments.find({
      where: { groupId },
      order: { paymentDate: 'DESC', createdAt: 'DESC' },
    });
    return rows.map(toPayment);
  }

  /**
   * @description Records a transfer between two members. Base amount equals the
   * amount (fxRate 1); multi-currency is not applied yet.
   */
  async create(groupId: string, actorId: string, body: CreatePaymentBody): Promise<Payment> {
    await this.validate(groupId, body);

    return this.dataSource.transaction(async (manager) => {
      const payment = manager.create(PaymentEntity, {
        groupId,
        fromMemberId: body.fromMemberId,
        toMemberId: body.toMemberId,
        amountMinor: body.amountMinor,
        currency: body.currency.toUpperCase(),
        fxRate: 1,
        amountBaseMinor: body.amountMinor,
        paymentDate: body.paymentDate,
        note: body.note ?? null,
        createdByMemberId: actorId,
      });
      await manager.save(payment);
      await this.activity.log(manager, {
        groupId,
        actorMemberId: actorId,
        action: 'payment.created',
        entityType: 'payment',
        entityId: payment.id,
        snapshot: { amountMinor: payment.amountMinor },
      });
      return toPayment(payment);
    });
  }

  async update(
    groupId: string,
    id: string,
    actorId: string,
    body: UpdatePaymentBody,
  ): Promise<Payment> {
    const payment = await this.payments.findOne({ where: { id, groupId } });
    if (!payment) throw AppError.notFound('PAYMENT_NOT_FOUND', 'Không tìm thấy lượt chuyển tiền');
    await this.validate(groupId, body);

    return this.dataSource.transaction(async (manager) => {
      payment.fromMemberId = body.fromMemberId;
      payment.toMemberId = body.toMemberId;
      payment.amountMinor = body.amountMinor;
      payment.currency = body.currency.toUpperCase();
      payment.amountBaseMinor = body.amountMinor;
      payment.paymentDate = body.paymentDate;
      payment.note = body.note ?? null;
      await manager.save(payment);
      await this.activity.log(manager, {
        groupId,
        actorMemberId: actorId,
        action: 'payment.updated',
        entityType: 'payment',
        entityId: id,
      });
      return toPayment(payment);
    });
  }

  /**
   * @description Lists soft-deleted payments. Payments have no title, so one is
   * built from the member names ("A → B") to tell entries apart in the trash.
   */
  async listDeleted(groupId: string): Promise<DeletedEntry[]> {
    const rows = await this.payments.find({
      where: { groupId, deletedAt: Not(IsNull()) },
      withDeleted: true,
      order: { deletedAt: 'DESC' },
    });
    if (rows.length === 0) return [];

    const members = await this.members.find({ where: { groupId } });
    const nameById = new Map(members.map((m) => [m.id, m.name]));
    const name = (id: string) => nameById.get(id) ?? '?';

    return rows.map((p) => ({
      id: p.id,
      kind: 'payment' as const,
      title: `${name(p.fromMemberId)} → ${name(p.toMemberId)}`,
      amountMinor: Number(p.amountMinor),
      currency: p.currency,
      entryDate: p.paymentDate,
      deletedAt: (p.deletedAt as Date).toISOString(),
    }));
  }

  /** @description Restores a soft-deleted payment, mirroring `ExpensesService.restore`. */
  async restore(groupId: string, id: string, actorId: string): Promise<Payment> {
    const payment = await this.payments.findOne({
      where: { id, groupId },
      withDeleted: true,
    });
    if (!payment) {
      throw AppError.notFound('PAYMENT_NOT_FOUND', 'Không tìm thấy lượt chuyển tiền');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.restore(PaymentEntity, { id });
      await this.activity.log(manager, {
        groupId,
        actorMemberId: actorId,
        action: 'payment.restored',
        entityType: 'payment',
        entityId: id,
      });
    });

    // Reload: the in-memory entity still carries the old deletedAt
    const restored = await this.payments.findOne({ where: { id, groupId } });
    return toPayment(restored as PaymentEntity);
  }

  async remove(groupId: string, id: string, actorId: string): Promise<void> {
    const payment = await this.payments.findOne({ where: { id, groupId } });
    if (!payment) throw AppError.notFound('PAYMENT_NOT_FOUND', 'Không tìm thấy lượt chuyển tiền');

    await this.dataSource.transaction(async (manager) => {
      // Delete by id, as in expenses: softRemove cascades into child relations
      // and throws if a child table has no deleted_at column.
      await manager.softDelete(PaymentEntity, { id: payment.id });
      await this.activity.log(manager, {
        groupId,
        actorMemberId: actorId,
        action: 'payment.deleted',
        entityType: 'payment',
        entityId: id,
      });
    });
  }

  /**
   * @description Ensures both members differ and belong to the group.
   * @throws {AppError} On a self-transfer or a member outside the group.
   */
  private async validate(groupId: string, body: CreatePaymentBody): Promise<void> {
    // Also enforced by a DB CHECK; validated here for a readable error
    if (body.fromMemberId === body.toMemberId) {
      throw AppError.badRequest('PAYMENT_SAME_MEMBER', 'Không thể tự chuyển cho chính mình');
    }
    const ids = [body.fromMemberId, body.toMemberId];
    const found = await this.members.find({ where: { id: In(ids), groupId } });
    if (found.length !== 2) {
      throw AppError.badRequest('MEMBER_NOT_IN_GROUP', 'Có thành viên không thuộc nhóm này');
    }
  }
}
