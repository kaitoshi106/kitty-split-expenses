import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Member } from '@kitty/shared-types';
import { formatMoney } from '@kitty/shared-money';
import { DataSource, Repository } from 'typeorm';
import { AppError } from '../../common/app-error';
import { pickAvatarColor } from '../../common/invite-code';
import { toMember } from '../../common/mappers';
import { GroupEntity, MemberEntity } from '../../entities';
import { ActivityService } from '../activity/activity.service';
import { BalancesService } from '../balances/balances.service';
import type {
  CreateMemberBody, UpdateMemberBody, UpdateMemberRoleBody,
} from './dto/member.dto';

@Injectable()
export class MembersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly balances: BalancesService,
    private readonly activity: ActivityService,
    @InjectRepository(MemberEntity) private readonly members: Repository<MemberEntity>,
    @InjectRepository(GroupEntity) private readonly groups: Repository<GroupEntity>,
  ) {}

  async findAll(groupId: string): Promise<Member[]> {
    const rows = await this.members.find({
      where: { groupId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return rows.map(toMember);
  }

  /** @description Adds a member with a unique (case-insensitive) name. */
  async create(groupId: string, actorId: string, body: CreateMemberBody): Promise<Member> {
    const name = body.name.trim();
    await this.assertNameFree(groupId, name);

    return this.dataSource.transaction(async (manager) => {
      const count = await manager.count(MemberEntity, { where: { groupId } });
      const member = manager.create(MemberEntity, {
        groupId,
        name,
        avatarColor: pickAvatarColor(count),
        role: 'member',
      });
      await manager.save(member);
      await this.activity.log(manager, {
        groupId,
        actorMemberId: actorId,
        action: 'member.created',
        entityType: 'member',
        entityId: member.id,
        snapshot: { name },
      });
      return toMember(member);
    });
  }

  /**
   * @description Renames a member. Members may rename themselves; renaming others requires admin.
   * @throws {AppError} When the member is missing, the actor lacks permission, or the name is taken.
   */
  async update(
    groupId: string,
    memberId: string,
    actorId: string,
    actorRole: 'admin' | 'member',
    body: UpdateMemberBody,
  ): Promise<Member> {
    const member = await this.members.findOne({ where: { id: memberId, groupId } });
    if (!member) throw AppError.notFound('MEMBER_NOT_FOUND', 'Không tìm thấy thành viên');

    if (actorRole !== 'admin' && actorId !== memberId) {
      throw AppError.forbidden(
        'RENAME_OTHERS_ADMIN_ONLY',
        'Chỉ quản trị nhóm mới đổi được tên người khác',
      );
    }

    const name = body.name.trim();
    if (name.toLowerCase() !== member.name.toLowerCase()) {
      await this.assertNameFree(groupId, name);
    }

    return this.dataSource.transaction(async (manager) => {
      const before = member.name;
      member.name = name;
      await manager.save(member);
      await this.activity.log(manager, {
        groupId,
        actorMemberId: actorId,
        action: 'member.renamed',
        entityType: 'member',
        entityId: memberId,
        snapshot: { before, after: name },
      });
      return toMember(member);
    });
  }

  /**
   * @description Promotes or demotes an admin. Groups may have several admins.
   * If a group has no admin at all, any member may promote; this grants nothing
   * new, since anyone with the invite code could already claim an admin member.
   * @throws {AppError} When a non-admin acts while admins exist, or when demoting the last admin.
   */
  async setRole(
    groupId: string,
    memberId: string,
    actorId: string,
    actorRole: 'admin' | 'member',
    body: UpdateMemberRoleBody,
  ): Promise<Member> {
    const member = await this.members.findOne({ where: { id: memberId, groupId } });
    if (!member) throw AppError.notFound('MEMBER_NOT_FOUND', 'Không tìm thấy thành viên');

    const adminCount = await this.members.count({ where: { groupId, role: 'admin' } });

    if (actorRole !== 'admin' && adminCount > 0) {
      throw AppError.forbidden(
        'ADMIN_ONLY',
        'Chỉ quản trị nhóm mới phong quyền cho người khác',
      );
    }

    // Demoting the last admin would leave the group without one
    if (member.role === 'admin' && body.role === 'member' && adminCount <= 1) {
      throw AppError.conflict(
        'LAST_ADMIN',
        'Nhóm phải còn ít nhất một quản trị. Hãy phong cho người khác trước.',
      );
    }

    if (member.role === body.role) return toMember(member);

    return this.dataSource.transaction(async (manager) => {
      member.role = body.role;
      await manager.save(member);
      await this.activity.log(manager, {
        groupId,
        actorMemberId: actorId,
        action: body.role === 'admin' ? 'member.promoted' : 'member.demoted',
        entityType: 'member',
        entityId: memberId,
        snapshot: { name: member.name, role: body.role },
      });
      return toMember(member);
    });
  }

  /**
   * @description Soft-deletes a member. Blocked while the member has a non-zero
   * balance, since removing it would break SUM(all balances) === 0. Also refuses
   * to remove the last member or the last admin.
   * @throws {AppError} When any of those guards fails.
   */
  async remove(groupId: string, memberId: string, actorId: string): Promise<void> {
    const member = await this.members.findOne({ where: { id: memberId, groupId } });
    if (!member) throw AppError.notFound('MEMBER_NOT_FOUND', 'Không tìm thấy thành viên');

    const balance = await this.balances.getMemberBalance(groupId, memberId);
    if (balance !== 0) {
      const group = await this.groups.findOne({ where: { id: groupId } });
      const pretty = formatMoney(balance, group?.baseCurrency ?? 'VND', { signed: true });
      throw AppError.conflict(
        'MEMBER_HAS_BALANCE',
        `${member.name} còn ${pretty}. Hãy ghi nhận chuyển tiền trước khi xoá.`,
        { balanceMinor: balance },
      );
    }

    const remaining = await this.members.count({ where: { groupId } });
    if (remaining <= 1) {
      throw AppError.conflict('LAST_MEMBER', 'Nhóm phải còn ít nhất một thành viên');
    }

    // Without an admin, nobody could change settings, rotate the invite code
    // or delete the group.
    if (member.role === 'admin') {
      const adminCount = await this.members.count({ where: { groupId, role: 'admin' } });
      if (adminCount <= 1) {
        throw AppError.conflict(
          'LAST_ADMIN',
          'Đây là quản trị duy nhất. Hãy phong quyền cho người khác trước khi xoá.',
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.softRemove(member);
      await this.activity.log(manager, {
        groupId,
        actorMemberId: actorId,
        action: 'member.removed',
        entityType: 'member',
        entityId: memberId,
        snapshot: { name: member.name },
      });
    });
  }

  /**
   * @description Ensures no active member already uses this name (case-insensitive).
   * @throws {AppError} When the name is taken.
   */
  private async assertNameFree(groupId: string, name: string): Promise<void> {
    const existing = await this.members
      .createQueryBuilder('m')
      .where('m.group_id = :groupId', { groupId })
      .andWhere('LOWER(TRIM(m.name)) = LOWER(:name)', { name })
      .andWhere('m.deleted_at IS NULL')
      .getOne();
    if (existing) {
      throw AppError.conflict('MEMBER_NAME_DUPLICATE', `Nhóm đã có người tên ${name}`);
    }
  }
}
