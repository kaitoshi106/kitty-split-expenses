import {
  Column, CreateDateColumn, Entity, Index, JoinColumn,
  ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { GroupEntity } from './group.entity';
import { MemberEntity } from './member.entity';

/**
 * Server-side session backing account-less JWTs (`{ sub: memberId, gid: groupId, role, jti }`).
 * The `jti` is checked on every request, allowing revocation before expiry (`revokedAt`)
 * and tracking active devices (`lastSeenAt`).
 */
@Entity('group_sessions')
@Index('group_sessions_member_idx', ['memberId'])
export class GroupSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId!: string;

  @Index('group_sessions_jti_uk', { unique: true })
  @Column({ type: 'uuid' })
  jti!: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ name: 'last_seen_at', type: 'timestamptz', default: () => 'now()' })
  lastSeenAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => GroupEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: GroupEntity;

  @ManyToOne(() => MemberEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member!: MemberEntity;
}
