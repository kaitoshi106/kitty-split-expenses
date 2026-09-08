import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionStore } from '../session.store';

/**
 * @description Adds `Authorization: Bearer <token>` to requests under /api/groups/:gid/*.
 * The token is chosen by the group id in the URL, not the currently open group,
 * so concurrent requests for different groups use the right identity.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionStore);

  // Group UUID immediately after /api/groups/
  const match = req.url.match(
    /\/api\/groups\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  if (!match) return next(req);

  const token = session.getToken(match[1]);
  if (!token) return next(req);

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
