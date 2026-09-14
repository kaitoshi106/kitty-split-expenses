import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @description Marks a route or controller as accessible without a token.
 * JwtAuthGuard is global and deny-by-default, so a forgotten decorator fails closed.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
