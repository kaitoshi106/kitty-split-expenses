import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { bigintTransformer } from '../common/transformers/bigint.transformer';
import { GroupEntity } from './group.entity';
import { MemberEntity } from './member.entity';

/**
 * Receipt image attached to an expense. A separate table because uploads happen before
 * the expense exists, and it leaves room for multiple receipts per expense.
 *
 * Bytes are stored in the database (`data`) because the hosting platform has no persistent
 * disk. `data` is `select: false` so only the download endpoint loads it; images are
 * compressed client-side. Rows with null `data` are legacy files still read from disk.
 */
@Entity('receipts')
@Index('receipts_group_idx', ['groupId'])
export class ReceiptEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  /**
   * Generated UUID filename, never the client-supplied name (path traversal).
   * Only used to locate legacy on-disk files, but still set on every upload for a uniform shape.
   */
  @Column({ type: 'varchar', length: 120 })
  filename!: string;

  /** Image bytes, loaded only on explicit request; null for legacy on-disk receipts. */
  @Column({ type: 'bytea', nullable: true, select: false })
  data!: Buffer | null;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'bigint', transformer: bigintTransformer })
  sizeBytes!: number;

  @Column({ name: 'uploaded_by_member_id', type: 'uuid' })
  uploadedByMemberId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => GroupEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: GroupEntity;

  @ManyToOne(() => MemberEntity)
  @JoinColumn({ name: 'uploaded_by_member_id' })
  uploadedBy!: MemberEntity;
}
