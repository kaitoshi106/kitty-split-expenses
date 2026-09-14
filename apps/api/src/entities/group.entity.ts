import {
  Column, CreateDateColumn, DeleteDateColumn, Entity, Index,
  OneToMany, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { CategoryEntity } from './category.entity';
import { ExpenseEntity } from './expense.entity';
import { MemberEntity } from './member.entity';
import { PaymentEntity } from './payment.entity';

@Entity('groups')
export class GroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  /** Currency every expense and payment is converted to for balance math. */
  @Column({ name: 'base_currency', type: 'char', length: 3, default: 'VND' })
  baseCurrency!: string;

  /** 8-character Crockford Base32 code, unique among active groups. */
  @Index('groups_invite_code_uk', { unique: true })
  @Column({ name: 'invite_code', type: 'varchar', length: 8 })
  inviteCode!: string;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl!: string | null;

  /** When true, settle-up minimizes transfers; otherwise it shows direct pairwise debts. */
  @Column({ name: 'simplify_debts', type: 'boolean', default: true })
  simplifyDebts!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /** Soft delete; TypeORM excludes these rows from find() by default. */
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt!: Date | null;

  @OneToMany(() => MemberEntity, (m) => m.group)
  members!: MemberEntity[];

  @OneToMany(() => CategoryEntity, (c) => c.group)
  categories!: CategoryEntity[];

  @OneToMany(() => ExpenseEntity, (e) => e.group)
  expenses!: ExpenseEntity[];

  @OneToMany(() => PaymentEntity, (p) => p.group)
  payments!: PaymentEntity[];
}
