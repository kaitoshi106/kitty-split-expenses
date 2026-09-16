import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { ActivityEntry } from '@kitty/shared-types';
import { EntityManager, LessThan, Repository } from 'typeorm';
import { ActivityLogEntity } from '../../entities';

/**
 * @description Records and reads the group activity log. Writes go through the
 * caller's EntityManager so an entry rolls back together with its action.
 */
@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(ActivityLogEntity)
    private readonly logs: Repository<ActivityLogEntity>,
  ) {}

  /**
   * @description Lists activity entries, newest first. Uses a timestamp cursor
   * rather than an offset so new entries cannot shift pages between loads.
   * Actor names are resolved at read time, so renames apply to old entries too.
   * @param groupId - Group to read.
   * @param opts - Page size and optional `before` cursor.
   * @returns Entries with the actor's current name.
   */
  async list(
    groupId: string,
    opts: { limit: number; before?: Date },
  ): Promise<ActivityEntry[]> {
    const rows = await this.logs.find({
      where: {
        groupId,
        ...(opts.before ? { createdAt: LessThan(opts.before) } : {}),
      },
      relations: { actor: true },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: opts.limit,
    });

    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      actorName: r.actor?.name ?? null,
      snapshot: r.snapshot,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /**
   * @description Appends an activity entry inside the caller's transaction.
   * @param manager - Transaction manager of the action being logged.
   * @param params - Entry fields; `snapshot` holds the data needed to render the entry later.
   */
  async log(
    manager: EntityManager,
    params: {
      groupId: string;
      actorMemberId: string | null;
      action: string;
      entityType: string;
      entityId: string;
      snapshot?: Record<string, unknown>;
    },
  ): Promise<void> {
    const entry = manager.create(ActivityLogEntity, {
      groupId: params.groupId,
      actorMemberId: params.actorMemberId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      snapshot: params.snapshot ?? null,
    });
    await manager.save(entry);
  }
}
