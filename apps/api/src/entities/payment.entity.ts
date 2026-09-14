import {
  Column, CreateDateColumn, DeleteDateColumn, Entity, Index,
  JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { bigintTransformer, numericTransformer } from '../common/transformers/bigint.transformer';
import { GroupEntity } from './group.entity';
import { MemberEntity } from './member.entity';

/**
 * Records a transfer that happened outside the app (no money is moved).
 * Payments feed the same balance formula as expenses; settle-up has no special case.
 */
@Entity('payments')
@Index('payments_group_date_idx', ['groupId', 'paymentDate'])
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'from_member_id', type: 'uuid' })
  fromMemberId!: string;

  @Column({ name: 'to_member_id', type: 'uuid' })
  toMemberId!: string;

  @Column({ name: 'amount_minor', type: 'bigint', transformer: bigintTransformer })
  amountMinor!: number;

  @Column({ type: 'char', length: 3 })
  currency!: string;

  @Column({ name: 'fx_rate', type: 'numeric', precision: 18, scale: 8, default: 1, transformer: numericTransformer })
  fxRate!: number;

  @Column({ name: 'amount_base_minor', type: 'bigint', transformer: bigintTransformer })
  amountBaseMinor!: number;

  @Column({ name: 'payment_date', type: 'date' })
  paymentDate!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by_member_id', type: 'uuid' })
  createdByMemberId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt!: Date | null;

  @ManyToOne(() => GroupEntity, (g) => g.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: GroupEntity;

  @ManyToOne(() => MemberEntity)
  @JoinColumn({ name: 'from_member_id' })
  fromMember!: MemberEntity;

  @ManyToOne(() => MemberEntity)
  @JoinColumn({ name: 'to_member_id' })
  toMember!: MemberEntity;
}
