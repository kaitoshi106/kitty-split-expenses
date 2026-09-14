import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IsNull, Repository } from 'typeorm';
import type { MemberContext } from '../../common/decorators/current-member.decorator';
import { GroupSessionEntity } from '../../entities';

export interface JwtPayload {
  sub: string; // memberId
  gid: string; // groupId
  role: 'admin' | 'member';
  jti: string;
}

/**
 * @description JWT authentication in two steps: Passport verifies signature and
 * expiry, then `validate()` checks the `jti` against `group_sessions` so tokens
 * can be revoked before they expire.
 *
 * The role is read from the database, not the token payload, so revoking admin
 * takes effect immediately. The member join rides on the session lookup, so it
 * costs no extra query.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(GroupSessionEntity)
    private readonly sessions: Repository<GroupSessionEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') as string,
    });
  }

  /**
   * @description Resolves a verified token to the caller's member context.
   * @param payload - Decoded token payload.
   * @returns Member context built from the session and member rows.
   * @throws {UnauthorizedException} When the session is revoked or the member was removed.
   */
  async validate(payload: JwtPayload): Promise<MemberContext> {
    const session = await this.sessions.findOne({
      where: { jti: payload.jti, revokedAt: IsNull() },
      relations: { member: true },
    });

    if (!session) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'SESSION_REVOKED',
        message: 'Phiên đã bị thu hồi, vui lòng tham gia lại nhóm',
      });
    }

    // The member was removed from the group; the session is no longer valid
    if (!session.member) {
      throw new UnauthorizedException({
        statusCode: 401,
        error: 'MEMBER_REMOVED',
        message: 'Bạn không còn trong nhóm này',
      });
    }

    // Fire-and-forget so the request is not delayed
    void this.sessions.update({ id: session.id }, { lastSeenAt: new Date() });

    // Every value comes from the database rows, not the token payload
    return {
      memberId: session.memberId,
      groupId: session.groupId,
      role: session.member.role,
      jti: payload.jti,
    };
  }
}
