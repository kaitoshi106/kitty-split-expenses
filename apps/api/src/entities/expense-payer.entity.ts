import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { bigintTransformer } from '../common/transformers/bigint.transformer';
import { ExpenseEntity } from './expense.entity';
import { MemberEntity } from './member.entity';

/** Who paid. Invariant: SUM(payers.amountMinor) === expense.amountMinor. */
@Entity('expense_payers')
@Index('expense_payers_uk', ['expenseId', 'memberId'], { unique: true })
@Index('expense_payers_member_idx', ['memberId'])
export class ExpensePayerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'expense_id', type: 'uuid' })
  expenseId!: string;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId!: string;

  @Column({ name: 'amount_minor', type: 'bigint', transformer: bigintTransformer })
  amountMinor!: number;

  @ManyToOne(() => ExpenseEntity, (e) => e.payers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'expense_id' })
  expense!: ExpenseEntity;

  @ManyToOne(() => MemberEntity)
  @JoinColumn({ name: 'member_id' })
  member!: MemberEntity;
}
