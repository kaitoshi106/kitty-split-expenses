import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { bigintTransformer, numericTransformer } from '../common/transformers/bigint.transformer';
import { ExpenseEntity } from './expense.entity';
import { MemberEntity } from './member.entity';

/** Who owes. Invariant: SUM(shares.amountMinor) === expense.amountMinor. */
@Entity('expense_shares')
@Index('expense_shares_uk', ['expenseId', 'memberId'], { unique: true })
@Index('expense_shares_member_idx', ['memberId'])
export class ExpenseShareEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'expense_id', type: 'uuid' })
  expenseId!: string;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId!: string;

  /** Raw user input (equal: null, exact: amount, percent: e.g. 33.3333, weight: e.g. 2), kept to re-open the form as entered. */
  @Column({ name: 'share_value', type: 'numeric', precision: 18, scale: 4, nullable: true, transformer: numericTransformer })
  shareValue!: number | null;

  /**
   * Final share in minor units after remainder distribution; the only column balances use.
   * May be 0 (e.g. 1 minor unit split three ways).
   */
  @Column({ name: 'amount_minor', type: 'bigint', transformer: bigintTransformer })
  amountMinor!: number;

  @ManyToOne(() => ExpenseEntity, (e) => e.shares, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expense_id' })
  expense!: ExpenseEntity;

  @ManyToOne(() => MemberEntity)
  @JoinColumn({ name: 'member_id' })
  member!: MemberEntity;
}
