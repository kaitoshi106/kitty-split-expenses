import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import type { Member } from '@kitty/shared-types';
import { CurrentMember, type MemberContext } from '../../common/decorators/current-member.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';
import { GroupMemberGuard } from '../../common/guards/group-member.guard';
import {
  CreateMemberBody, UpdateMemberBody, UpdateMemberRoleBody,
} from './dto/member.dto';
import { MembersService } from './members.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Members')
@ApiBearerAuth('token')
@Controller('groups/:gid/members')
@UseGuards(GroupMemberGuard)
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  findAll(@Param('gid', ParseUUIDPipe) gid: string): Promise<Member[]> {
    return this.members.findAll(gid);
  }

  @Post()
  create(
    @Param('gid', ParseUUIDPipe) gid: string,
    @CurrentMember() me: MemberContext,
    @Body() body: CreateMemberBody,
  ): Promise<Member> {
    return this.members.create(gid, me.memberId, body);
  }

  @Patch(':mid')
  update(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Param('mid', ParseUUIDPipe) mid: string,
    @CurrentMember() me: MemberContext,
    @Body() body: UpdateMemberBody,
  ): Promise<Member> {
    return this.members.update(gid, mid, me.memberId, me.role, body);
  }

  /**
   * @description Grants or revokes admin. No AdminGuard here: the service checks
   * permissions itself so a group left without any admin can recover.
   */
  @Patch(':mid/role')
  setRole(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Param('mid', ParseUUIDPipe) mid: string,
    @CurrentMember() me: MemberContext,
    @Body() body: UpdateMemberRoleBody,
  ): Promise<Member> {
    return this.members.setRole(gid, mid, me.memberId, me.role, body);
  }

  /**
   * @description Removes a member. Admin-only, unlike adding members, because
   * removal affects the whole group and could be used to push someone out of
   * the split. Renaming (PATCH) is allowed for an admin or the member themself.
   */
  @Delete(':mid')
  @UseGuards(AdminGuard)
  @HttpCode(204)
  remove(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Param('mid', ParseUUIDPipe) mid: string,
    @CurrentMember() me: MemberContext,
  ): Promise<void> {
    return this.members.remove(gid, mid, me.memberId);
  }
}
