import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { SessionStore } from '../session.store';

/**
 * @description Blocks /g/:gid/* when this device holds no token for the group,
 * redirecting to the join screen.
 */
export const groupTokenGuard: CanActivateFn = (route) => {
  const session = inject(SessionStore);
  const router = inject(Router);

  const gid = route.paramMap.get('gid');
  if (gid && session.getToken(gid)) return true;

  return router.createUrlTree(['/join']);
};
