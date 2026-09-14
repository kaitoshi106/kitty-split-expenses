import {
  Column, CreateDateColumn, DeleteDateColumn, Entity, Index, JoinColumn,
  ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import type { SplitType } from '@kitty/shared-types';
import { bigintTransformer, numericTransformer } from '../common/transformers/bigint.transformer';
import { CategoryEntity } from './category.entity';
import { ExpensePayerEntity } from './expense-payer.entity';
import { ExpenseShareEntity } from './expense-share.entity';
import { GroupEntity } from './group.entity';
import { MemberEntity } from './member.entity';

/**
 * Holds only the total; the two sides of the flow live in child tables:
 * `expense_payers` (who paid, possibly several) and `expense_shares` (who owes, possibly uneven).
 */
@Entity('expenses')
@Index('expenses_group_date_idx', ['groupId', 'expenseDate'])
@Index('expenses_category_idx', ['categoryId'])
@Index('expenses_idempotency_uk', ['groupId', 'idempotencyKey'], { unique: true })
export class ExpenseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId!: string | null;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  /** Amount in minor units of `currency`, exactly as entered. */
  @Column({ name: 'amount_minor', type: 'bigint', transformer: bigintTransformer })
  amountMinor!: number;

  @Column({ type: 'char', length: 3 })
  currency!: string;

  /** Exchange rate frozen at entry time, so later rate changes never alter past balances. */
  @Column({ name: 'fx_rate', type: 'numeric', precision: 18, scale: 8, default: 1, transformer: numericTransformer })
  fxRate!: number;

  /** round(amountMinor * fxRate), in the group's base currency. */
  @Column({ name: 'amount_base_minor', type: 'bigint', transformer: bigintTransformer })
  amountBaseMinor!: number;

  /** One split type per expense, hence stored here rather than on shares. */
  @Column({ name: 'split_type', type: 'varchar', length: 10, default: 'equal' })
  splitType!: SplitType;

  @Column({ name: 'expense_date', type: 'date' })
  expenseDate!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by_member_id', type: 'uuid' })
  createdByMemberId!: string;

  /** Double-submit guard; the client generates it when the form opens, not on submit. */
  @Column({ name: 'idempotency_key', type: 'uuid', nullable: true })
  idempotencyKey!: string | null;

  /** Attached receipt, if any. */
  @Column({ name: 'receipt_id', type: 'uuid', nullable: true })
  receiptId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt!: Date | null;

  @ManyToOne(() => GroupEntity, (g) => g.expenses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: GroupEntity;

  @ManyToOne(() => CategoryEntity, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category!: CategoryEntity | null;

  @ManyToOne(() => MemberEntity)
  @JoinColumn({ name: 'created_by_member_id' })
  createdBy!: MemberEntity;

  // Cascade: saving an expense persists its payers and shares in the same transaction.
  @OneToMany(() => ExpensePayerEntity, (p) => p.expense, { cascade: true, eager: true })
  payers!: ExpensePayerEntity[];

  @OneToMany(() => ExpenseShareEntity, (s) => s.expense, { cascade: true, eager: true })
  shares!: ExpenseShareEntity[];
}
