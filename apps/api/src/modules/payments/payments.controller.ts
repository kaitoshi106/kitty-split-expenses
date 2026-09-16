import {
  Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import type { DeletedEntry, Payment } from '@kitty/shared-types';
import { CurrentMember, type MemberContext } from '../../common/decorators/current-member.decorator';
import { GroupMemberGuard } from '../../common/guards/group-member.guard';
import { CreatePaymentBody, UpdatePaymentBody } from './dto/payment.dto';
import { PaymentsService } from './payments.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Payments')
@ApiBearerAuth('token')
@Controller('groups/:gid/payments')
@UseGuards(GroupMemberGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  findAll(@Param('gid', ParseUUIDPipe) gid: string): Promise<Payment[]> {
    return this.payments.findAll(gid);
  }

  @Post()
  create(
    @Param('gid', ParseUUIDPipe) gid: string,
    @CurrentMember() me: MemberContext,
    @Body() body: CreatePaymentBody,
  ): Promise<Payment> {
    return this.payments.create(gid, me.memberId, body);
  }

  @Get('deleted')
  findDeleted(@Param('gid', ParseUUIDPipe) gid: string): Promise<DeletedEntry[]> {
    return this.payments.listDeleted(gid);
  }

  @Post(':pid/restore')
  restore(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @CurrentMember() me: MemberContext,
  ): Promise<Payment> {
    return this.payments.restore(gid, pid, me.memberId);
  }

  @Patch(':pid')
  update(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @CurrentMember() me: MemberContext,
    @Body() body: UpdatePaymentBody,
  ): Promise<Payment> {
    return this.payments.update(gid, pid, me.memberId, body);
  }

  @Delete(':pid')
  @HttpCode(204)
  remove(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Param('pid', ParseUUIDPipe) pid: string,
    @CurrentMember() me: MemberContext,
  ): Promise<void> {
    return this.payments.remove(gid, pid, me.memberId);
  }
}
