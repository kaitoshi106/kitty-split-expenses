import {
  Column, CreateDateColumn, DeleteDateColumn, Entity, Index,
  JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { GroupEntity } from './group.entity';

@Entity('categories')
@Index('categories_group_idx', ['groupId'])
export class CategoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** NULL for built-in categories shared by every group. */
  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId!: string | null;

  @Column({ type: 'varchar', length: 40 })
  name!: string;

  @Column({ type: 'varchar', length: 40 })
  icon!: string;

  @Column({ type: 'char', length: 7, default: '#94A3B8' })
  color!: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt!: Date | null;

  @ManyToOne(() => GroupEntity, (g) => g.categories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: GroupEntity | null;
}
