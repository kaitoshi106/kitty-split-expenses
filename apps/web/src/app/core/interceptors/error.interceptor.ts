import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import type { ApiError } from '@kitty/shared-types';
import { I18nService } from '../i18n/i18n.service';
import { SessionStore } from '../session.store';
import type { TranslationKey } from '../i18n/translations.vi';
import { ToastService } from '../toast.service';

/**
 * Backend error code -> translation key. Matching is on the machine-readable `error`
 * code, never on `message`, so backend wording changes cannot break the frontend.
 */
const MESSAGES: Record<string, TranslationKey> = {
  SESSION_REVOKED: 'error.sessionRevoked',
  WRONG_GROUP: 'error.wrongGroup',
  INVITE_CODE_NOT_FOUND: 'error.inviteNotFound',
  MEMBER_HAS_BALANCE: 'error.memberHasBalance',
  MEMBER_NAME_DUPLICATE: 'error.memberNameDuplicate',
  LAST_MEMBER: 'error.lastMember',
  LAST_ADMIN: 'error.lastAdmin',
  MEMBER_REMOVED: 'error.memberRemoved',
  PAYMENT_SAME_MEMBER: 'error.paymentSameMember',
  ADMIN_ONLY: 'error.adminOnly',
  RENAME_OTHERS_ADMIN_ONLY: 'error.renameOthersAdminOnly',
};

/**
 * @description Extracts the group id from `/api/groups/<uuid>/...`.
 * @returns The id, or null for routes not tied to a group (`/groups`, `/groups/lookup`).
 */
function groupIdFrom(url: string): string | null {
  return /\/groups\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/|$|\?)/i
    .exec(url)?.[1] ?? null;
}

/**
 * @description Whether the error means the stored group session is permanently unusable:
 * 401 (token revoked/invalid), 404 GROUP_NOT_FOUND (group deleted) or 403 WRONG_GROUP.
 * 5xx is deliberately excluded so a transient outage never discards a valid token.
 */
function isDeadEntry(err: HttpErrorResponse, code?: string): boolean {
  if (err.status === 401) return true;
  if (err.status === 404 && code === 'GROUP_NOT_FOUND') return true;
  if (err.status === 403 && code === 'WRONG_GROUP') return true;
  return false;
}

/**
 * @description Distinguishes an unreachable backend from a business error. The dev proxy
 * answers with an empty or non-JSON 5xx when the API is down, whereas the API's exception
 * filter always returns JSON with an `error` field.
 */
function isBackendUnreachable(err: HttpErrorResponse): boolean {
  if (err.status !== 500 && err.status !== 502 && err.status !== 504) return false;
  const body = err.error;
  if (!body) return true; // empty body
  if (typeof body === 'string') return true; // HTML or text, not API JSON
  return typeof body === 'object' && !('error' in body); // foreign JSON
}

/**
 * @description Maps HTTP errors to user-facing toasts and drops dead groups from the
 * recent-groups list. The error is rethrown so callers can still react.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const router = inject(Router);
  const i18n = inject(I18nService);
  const session = inject(SessionStore);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const body = err.error as ApiError | undefined;
      const code = body?.error;

      // Forget dead groups; otherwise the broken entry stays in localStorage with no way
      // to remove it from the UI (an installed iOS PWA's storage is separate from Safari's).
      const gid = groupIdFrom(req.url);
      const dead = isDeadEntry(err, code);
      if (gid && dead) session.forgetGroup(gid);

      if (err.status === 0) {
        // Request never reached a server: offline or blocked by CORS.
        toast.error(i18n.t('error.network'));
      } else if (isBackendUnreachable(err)) {
        // API not running (common in dev while NestJS is still building), not a business error.
        toast.error(i18n.t('error.backendDown'));
      } else if (gid && dead) {
        // Explain why the group just disappeared from the recent list.
        toast.error(
          i18n.t(
            err.status === 404 ? 'error.groupGoneRemoved' : 'error.sessionGoneRemoved',
          ),
        );
        void router.navigate(['/']);
      } else if (code && MESSAGES[code]) {
        toast.error(i18n.t(MESSAGES[code]));
      } else if (body?.message) {
        // Backend supplied a specific localized message.
        toast.error(body.message);
      } else {
        toast.error(i18n.t('error.generic'));
      }

      return throwError(() => err);
    }),
  );
};
