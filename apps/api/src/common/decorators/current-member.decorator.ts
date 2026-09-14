import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface MemberContext {
  memberId: string;
  groupId: string;
  role: 'admin' | 'member';
  jti: string;
}

/**
 * @description Injects the authenticated member from the verified JWT,
 * e.g. `create(@CurrentMember() me: MemberContext)`, so handlers never touch `request`.
 */
export const CurrentMember = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MemberContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as MemberContext;
  },
);
