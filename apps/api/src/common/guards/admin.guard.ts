import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppError } from '../app-error';
import type { MemberContext } from '../decorators/current-member.decorator';

/** @description Allows only the group admin through (settings changes, group deletion). */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user as MemberContext | undefined;
    if (user?.role !== 'admin') {
      throw AppError.forbidden('ADMIN_ONLY', 'Chỉ quản trị nhóm mới làm được việc này');
    }
    return true;
  }
}
