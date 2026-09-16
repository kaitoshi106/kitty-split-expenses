import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import type { Balance, GroupSummary, MemberDetail } from '@kitty/shared-types';
import { GroupMemberGuard } from '../../common/guards/group-member.guard';
import { BalancesService } from './balances.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Balances')
@ApiBearerAuth('token')
@Controller('groups/:gid')
@UseGuards(GroupMemberGuard) // The token must belong to the group in the URL
export class BalancesController {
  constructor(private readonly balances: BalancesService) {}

  @Get('balances')
  getBalances(@Param('gid', ParseUUIDPipe) gid: string): Promise<Balance[]> {
    return this.balances.getBalances(gid);
  }

  @Get('summary')
  getSummary(@Param('gid', ParseUUIDPipe) gid: string): Promise<GroupSummary> {
    return this.balances.getSummary(gid);
  }

  @Get('members/:mid/detail')
  getMemberDetail(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Param('mid', ParseUUIDPipe) mid: string,
  ): Promise<MemberDetail> {
    return this.balances.getMemberDetail(gid, mid);
  }
}
