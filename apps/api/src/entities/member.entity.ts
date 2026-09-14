import {
  Column, CreateDateColumn, DeleteDateColumn, Entity, Index,
  JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { GroupEntity } from './group.entity';

@Entity('members')
@Index('members_group_idx', ['groupId'])
export class MemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  /** Display name; the avatar is derived from its initials on the client. */
  @Column({ type: 'varchar', length: 60 })
  name!: string;

  /** Assigned at creation and persisted so it stays stable. */
  @Column({ name: 'avatar_color', type: 'char', length: 7, default: '#6366F1' })
  avatarColor!: string;

  @Column({ type: 'varchar', length: 10, default: 'member' })
  role!: 'admin' | 'member';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt!: Date | null;

  @ManyToOne(() => GroupEntity, (g) => g.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: GroupEntity;
}
