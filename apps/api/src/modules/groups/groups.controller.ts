import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import type { Group } from '@kitty/shared-types';
import { CurrentMember, type MemberContext } from '../../common/decorators/current-member.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';
import { GroupMemberGuard } from '../../common/guards/group-member.guard';
import { UpdateGroupBody } from './dto/group.dto';
import { GroupsService } from './groups.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Groups')
@ApiBearerAuth('token')
@Controller('groups/:gid')
@UseGuards(GroupMemberGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  findOne(@Param('gid', ParseUUIDPipe) gid: string): Promise<Group> {
    return this.groups.findOne(gid);
  }

  @Patch()
  @UseGuards(AdminGuard)
  update(
    @Param('gid', ParseUUIDPipe) gid: string,
    @CurrentMember() me: MemberContext,
    @Body() body: UpdateGroupBody,
  ): Promise<Group> {
    return this.groups.update(gid, me.memberId, body);
  }

  @Post('invite-code')
  @UseGuards(AdminGuard)
  regenerate(
    @Param('gid', ParseUUIDPipe) gid: string,
    @CurrentMember() me: MemberContext,
  ): Promise<Group> {
    return this.groups.regenerateInviteCode(gid, me.memberId);
  }

  @Delete()
  @UseGuards(AdminGuard)
  @HttpCode(204)
  remove(@Param('gid', ParseUUIDPipe) gid: string): Promise<void> {
    return this.groups.remove(gid);
  }
}
