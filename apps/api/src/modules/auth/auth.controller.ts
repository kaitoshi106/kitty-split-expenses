import { Body, Controller, Headers, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { AuthResult, LookupGroupResult } from '@kitty/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { ClaimMemberBody, CreateGroupBody, LookupGroupBody } from './dto/auth.dto';
import { ApiTags } from '@nestjs/swagger';

/**
 * @description Public endpoints for creating a group and joining one via invite code.
 * Routing only; all business logic lives in `AuthService`.
 */
@ApiTags('Auth')
@Controller('groups')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post()
  createGroup(
    @Body() body: CreateGroupBody,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResult> {
    return this.auth.createGroup(body, userAgent ?? null);
  }

  /** Previews a group by invite code without issuing a token. */
  @Public()
  @Post('lookup')
  lookup(@Body() body: LookupGroupBody): Promise<LookupGroupResult> {
    return this.auth.lookup(body.inviteCode);
  }

  /** Claims an existing member (or creates one) and issues a session token. */
  @Public()
  @Post(':gid/claim')
  claim(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Body() body: ClaimMemberBody,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResult> {
    return this.auth.claim(gid, body, userAgent ?? null);
  }
}
