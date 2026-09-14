import type { ExecutionContext } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { GroupMemberGuard } from './group-member.guard';
import type { MemberContext } from '../decorators/current-member.decorator';
import { AppError } from '../app-error';

/**
 * @description Asserts that `fn` throws an AppError with the given code and HTTP status.
 * Checks `code` rather than `message`, which is localized text for humans.
 * @param fn - Callback expected to throw.
 * @param code - Expected machine-readable error code.
 * @param status - Expected HTTP status.
 */
function expectAppError(fn: () => unknown, code: string, status: number): void {
  try {
    fn();
  } catch (err) {
    const e = err as AppError;
    expect(e).toBeInstanceOf(AppError);
    expect(e.code).toBe(code);
    expect(e.getStatus()).toBe(status);
    return;
  }
  throw new Error(`Expected ${code} to be thrown, but nothing was thrown`);
}

/** @description Builds a minimal ExecutionContext exposing `user` and route `params`. */
function ctx(user: MemberContext | undefined, params: Record<string, string> = {}) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, params }) }),
  } as unknown as ExecutionContext;
}

const admin: MemberContext = {
  memberId: 'm1', groupId: 'g1', role: 'admin', jti: 'j1',
};
const member: MemberContext = {
  memberId: 'm2', groupId: 'g1', role: 'member', jti: 'j2',
};

describe('GroupMemberGuard (IDOR protection)', () => {
  const guard = new GroupMemberGuard();

  it('allows a token that belongs to the group in the URL', () => {
    expect(guard.canActivate(ctx(member, { gid: 'g1' }))).toBe(true);
  });

  it('rejects a token from another group', () => {
    expectAppError(() => guard.canActivate(ctx(member, { gid: 'g2' })), 'WRONG_GROUP', 403);
  });

  it('rejects a request without a session', () => {
    expectAppError(() => guard.canActivate(ctx(undefined, { gid: 'g1' })), 'NO_SESSION', 401);
  });

  it('allows routes without a group parameter', () => {
    expect(guard.canActivate(ctx(member))).toBe(true);
  });

  it('also reads the groupId parameter name', () => {
    expect(guard.canActivate(ctx(member, { groupId: 'g1' }))).toBe(true);
    expectAppError(() => guard.canActivate(ctx(member, { groupId: 'g9' })), 'WRONG_GROUP', 403);
  });
});

describe('AdminGuard (group creator only)', () => {
  const guard = new AdminGuard();

  it('allows the admin', () => {
    expect(guard.canActivate(ctx(admin))).toBe(true);
  });

  it('rejects a regular member', () => {
    expectAppError(() => guard.canActivate(ctx(member)), 'ADMIN_ONLY', 403);
  });

  it('rejects a request without a session', () => {
    expectAppError(() => guard.canActivate(ctx(undefined)), 'ADMIN_ONLY', 403);
  });
});
