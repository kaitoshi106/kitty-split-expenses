import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Group } from '@kitty/shared-types';
import { DataSource, Repository } from 'typeorm';
import { AppError } from '../../common/app-error';
import { generateInviteCode } from '../../common/invite-code';
import { toGroup } from '../../common/mappers';
import { GroupEntity, GroupSessionEntity } from '../../entities';
import { ActivityService } from '../activity/activity.service';
import type { UpdateGroupBody } from './dto/group.dto';

@Injectable()
export class GroupsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly activity: ActivityService,
    @InjectRepository(GroupEntity) private readonly groups: Repository<GroupEntity>,
  ) {}

  async findOne(groupId: string): Promise<Group> {
    const group = await this.groups.findOne({ where: { id: groupId } });
    if (!group) throw AppError.notFound('GROUP_NOT_FOUND', 'Không tìm thấy nhóm');
    return toGroup(group);
  }

  async update(groupId: string, actorId: string, body: UpdateGroupBody): Promise<Group> {
    return this.dataSource.transaction(async (manager) => {
      const group = await manager.findOne(GroupEntity, { where: { id: groupId } });
      if (!group) throw AppError.notFound('GROUP_NOT_FOUND', 'Không tìm thấy nhóm');

      const before = { ...group };
      if (body.name !== undefined) group.name = body.name.trim();
      if (body.baseCurrency !== undefined) group.baseCurrency = body.baseCurrency.toUpperCase();
      if (body.photoUrl !== undefined) group.photoUrl = body.photoUrl;
      if (body.simplifyDebts !== undefined) group.simplifyDebts = body.simplifyDebts;

      await manager.save(group);
      await this.activity.log(manager, {
        groupId,
        actorMemberId: actorId,
        action: 'group.updated',
        entityType: 'group',
        entityId: groupId,
        snapshot: { before: { name: before.name, baseCurrency: before.baseCurrency } },
      });
      return toGroup(group);
    });
  }

  /**
   * @description Issues a new invite code and revokes every other member's
   * session, for when the old code may have leaked. The caller stays signed in.
   */
  async regenerateInviteCode(groupId: string, actorId: string): Promise<Group> {
    return this.dataSource.transaction(async (manager) => {
      const group = await manager.findOne(GroupEntity, { where: { id: groupId } });
      if (!group) throw AppError.notFound('GROUP_NOT_FOUND', 'Không tìm thấy nhóm');

      group.inviteCode = generateInviteCode();
      await manager.save(group);
      await manager
        .createQueryBuilder()
        .update(GroupSessionEntity)
        .set({ revokedAt: new Date() })
        .where('group_id = :groupId AND revoked_at IS NULL AND member_id <> :actorId', {
          groupId,
          actorId,
        })
        .execute();

      await this.activity.log(manager, {
        groupId,
        actorMemberId: actorId,
        action: 'group.invite_regenerated',
        entityType: 'group',
        entityId: groupId,
      });
      return toGroup(group);
    });
  }

  async remove(groupId: string): Promise<void> {
    const group = await this.groups.findOne({ where: { id: groupId } });
    if (!group) throw AppError.notFound('GROUP_NOT_FOUND', 'Không tìm thấy nhóm');
    await this.groups.softRemove(group); // soft delete, recoverable
  }
}
