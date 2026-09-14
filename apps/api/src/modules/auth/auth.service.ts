import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthResult, LookupGroupResult } from '@kitty/shared-types';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AppError } from '../../common/app-error';
import {
  generateInviteCode, normalizeInviteCode, pickAvatarColor,
} from '../../common/invite-code';
import { toGroup, toMember } from '../../common/mappers';
import {
  CategoryEntity, GroupEntity, GroupSessionEntity, MemberEntity,
} from '../../entities';
import type { ClaimMemberBody, CreateGroupBody } from './dto/auth.dto';
import type { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(GroupEntity) private readonly groups: Repository<GroupEntity>,
    @InjectRepository(MemberEntity) private readonly members: Repository<MemberEntity>,
  ) {}

  /**
   * @description Creates a group, its members and the creator's session in one
   * transaction, so a failure cannot leave an empty, unreachable group.
   * The first name becomes the admin and is bound to this device.
   * @param body - Group name, base currency and member names.
   * @param userAgent - Stored on the session for display.
   * @returns Session token, group and the admin member.
   * @throws {AppError} When no names remain after trimming or names collide case-insensitively.
   */
  async createGroup(body: CreateGroupBody, userAgent: string | null): Promise<AuthResult> {
    const names = body.memberNames.map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) {
      throw AppError.badRequest('MEMBERS_REQUIRED', 'Nhóm cần ít nhất một thành viên');
    }
    const lower = names.map((n) => n.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      throw AppError.conflict('MEMBER_NAME_DUPLICATE', 'Có hai thành viên trùng tên');
    }

    return this.dataSource.transaction(async (manager) => {
      const group = manager.create(GroupEntity, {
        name: body.name.trim(),
        baseCurrency: body.baseCurrency.toUpperCase(),
        inviteCode: await this.uniqueInviteCode(manager.getRepository(GroupEntity)),
        photoUrl: null,
        simplifyDebts: true,
      });
      await manager.save(group);

      // createdAt is set explicitly, 1 ms apart: Postgres now() is constant
      // within a transaction, so identical timestamps would make member order
      // unstable.
      const baseTime = Date.now();
      const memberEntities = names.map((name, index) =>
        manager.create(MemberEntity, {
          groupId: group.id,
          name,
          avatarColor: pickAvatarColor(index),
          role: index === 0 ? 'admin' : 'member',
          createdAt: new Date(baseTime + index),
        }),
      );
      await manager.save(memberEntities);

      const admin = memberEntities[0];
      const token = await this.issueToken(manager, group.id, admin, userAgent);

      return { token, group: toGroup(group), member: toMember(admin) };
    });
  }

  /**
   * @description Join step 1: previews a group by invite code. Returns member
   * names only; financial data stays hidden until a member is claimed.
   * @throws {AppError} When the code matches no group.
   */
  async lookup(inviteCode: string): Promise<LookupGroupResult> {
    const code = normalizeInviteCode(inviteCode);
    const group = await this.groups.findOne({ where: { inviteCode: code } });
    if (!group) {
      throw AppError.notFound('INVITE_CODE_NOT_FOUND', 'Mã không đúng hoặc nhóm đã bị xoá');
    }
    const members = await this.members.find({
      where: { groupId: group.id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return {
      group: { id: group.id, name: group.name, baseCurrency: group.baseCurrency },
      members: members.map((m) => ({ id: m.id, name: m.name, avatarColor: m.avatarColor })),
    };
  }

  /**
   * @description Join step 2: the user picks an existing member or adds a new
   * one, and receives a session token. This replaces account sign-up.
   * @param body - Either `memberId` or `newMemberName`.
   * @throws {AppError} When the member is not in the group, the name is taken,
   * or neither field is given.
   */
  async claim(
    groupId: string,
    body: ClaimMemberBody,
    userAgent: string | null,
  ): Promise<AuthResult> {
    const group = await this.groups.findOne({ where: { id: groupId } });
    if (!group) throw AppError.notFound('GROUP_NOT_FOUND', 'Không tìm thấy nhóm');

    return this.dataSource.transaction(async (manager) => {
      let member: MemberEntity | null = null;

      if (body.memberId) {
        // Scope by groupId so members of other groups cannot be claimed
        member = await manager.findOne(MemberEntity, {
          where: { id: body.memberId, groupId },
        });
        if (!member) {
          throw AppError.notFound('MEMBER_NOT_FOUND', 'Thành viên không thuộc nhóm này');
        }
      } else if (body.newMemberName) {
        const name = body.newMemberName.trim();
        const existing = await manager
          .createQueryBuilder(MemberEntity, 'm')
          .where('m.group_id = :groupId', { groupId })
          .andWhere('LOWER(TRIM(m.name)) = LOWER(:name)', { name })
          .andWhere('m.deleted_at IS NULL')
          .getOne();
        if (existing) {
          throw AppError.conflict('MEMBER_NAME_DUPLICATE', `Nhóm đã có người tên ${name}`);
        }
        const count = await manager.count(MemberEntity, { where: { groupId } });
        member = manager.create(MemberEntity, {
          groupId,
          name,
          avatarColor: pickAvatarColor(count),
          role: 'member',
        });
        await manager.save(member);
      } else {
        throw AppError.badRequest(
          'CLAIM_TARGET_REQUIRED',
          'Cần chọn thành viên có sẵn hoặc nhập tên mới',
        );
      }

      const token = await this.issueToken(manager, groupId, member, userAgent);
      return { token, group: toGroup(group), member: toMember(member) };
    });
  }

  /** @description Revokes every active session in a group. */
  async revokeAllSessions(groupId: string): Promise<void> {
    await this.dataSource
      .getRepository(GroupSessionEntity)
      .update({ groupId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  /**
   * @description Creates a session row and signs a JWT whose `jti` references it.
   * @returns Signed token.
   */
  private async issueToken(
    manager: EntityManager,
    groupId: string,
    member: MemberEntity,
    userAgent: string | null,
  ): Promise<string> {
    const jti = randomUUID();
    const session = new GroupSessionEntity();
    session.groupId = groupId;
    session.memberId = member.id;
    session.jti = jti;
    session.userAgent = userAgent;
    await manager.save(session);

    const payload: JwtPayload = {
      sub: member.id,
      gid: groupId,
      role: member.role,
      jti,
    };
    // expiresIn is configured in AuthModule
    return this.jwt.signAsync(payload);
  }

  /** @description Generates an unused invite code, retrying on the rare collision (32^8 ≈ 1.1e12 codes). */
  private async uniqueInviteCode(repo: Repository<GroupEntity>): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = generateInviteCode();
      const existing = await repo.findOne({ where: { inviteCode: code } });
      if (!existing) return code;
    }
    throw AppError.conflict('INVITE_CODE_GENERATION_FAILED', 'Không sinh được mã mời');
  }
}
