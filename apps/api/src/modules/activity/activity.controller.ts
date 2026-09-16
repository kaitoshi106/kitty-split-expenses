import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import type { ActivityEntry } from '@kitty/shared-types';
import { GroupMemberGuard } from '../../common/guards/group-member.guard';
import { ActivityService } from './activity.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Maximum number of entries returned per page. */
const MAX_LIMIT = 50;

@ApiTags('Activity')
@ApiBearerAuth('token')
@Controller('groups/:gid/activity')
@UseGuards(GroupMemberGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  /**
   * @description Lists a group's activity, newest first. The log is read-only over
   * HTTP: entries are written only inside the transaction of the action that
   * caused them (see `ActivityService.log`), so the log cannot drift from the data.
   * @param limit - Page size, clamped to `MAX_LIMIT`; invalid values fall back to 30.
   * @param before - ISO timestamp cursor; only entries older than this are returned.
   */
  @Get()
  list(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ): Promise<ActivityEntry[]> {
    // Fall back to defaults instead of returning 400; a bad pagination param
    // should not break the screen.
    const parsed = Number(limit);
    const take = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_LIMIT) : 30;

    const cursor = before ? new Date(before) : undefined;
    return this.activity.list(gid, {
      limit: take,
      before: cursor && !Number.isNaN(cursor.getTime()) ? cursor : undefined,
    });
  }
}
