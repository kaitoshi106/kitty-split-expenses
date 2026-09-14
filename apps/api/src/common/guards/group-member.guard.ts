import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppError } from '../app-error';
import type { MemberContext } from '../decorators/current-member.decorator';

/**
 * @description Prevents IDOR across groups: JwtAuthGuard only proves the token is valid,
 * this guard proves it belongs to the group in the URL (`:gid` or `:groupId`).
 * Without it, a token for group A could read `/groups/B/expenses`.
 * @throws {AppError} 401 when there is no session, 403 when the group does not match.
 */
@Injectable()
export class GroupMemberGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as MemberContext | undefined;
    const groupId = request.params?.gid ?? request.params?.groupId;

    if (!user) {
      throw AppError.unauthorized('NO_SESSION', 'Chưa có phiên làm việc');
    }
    if (groupId && user.groupId !== groupId) {
      throw AppError.forbidden(
        'WRONG_GROUP',
        'Token này không thuộc nhóm bạn đang truy cập',
      );
    }
    return true;
  }
}
