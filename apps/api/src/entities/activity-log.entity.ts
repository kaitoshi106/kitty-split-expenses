import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { GroupEntity } from './group.entity';
import { MemberEntity } from './member.entity';

/** Append-only audit trail per group, so members can see why their balance changed. */
@Entity('activity_logs')
@Index('activity_logs_group_time_idx', ['groupId', 'createdAt'])
export class ActivityLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'actor_member_id', type: 'uuid', nullable: true })
  actorMemberId!: string | null;

  /** Event name, e.g. `expense.created`, `member.removed`, `payment.deleted`. */
  @Column({ type: 'varchar', length: 40 })
  action!: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 20 })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId!: string;

  @Column({ type: 'jsonb', nullable: true })
  snapshot!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => GroupEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: GroupEntity;

  @ManyToOne(() => MemberEntity, { nullable: true })
  @JoinColumn({ name: 'actor_member_id' })
  actor!: MemberEntity | null;
}
