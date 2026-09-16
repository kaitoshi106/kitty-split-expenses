import {
  Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe,
  Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import type { DeletedEntry, Expense } from '@kitty/shared-types';
import { CurrentMember, type MemberContext } from '../../common/decorators/current-member.decorator';
import { GroupMemberGuard } from '../../common/guards/group-member.guard';
import { CreateExpenseBody, UpdateExpenseBody } from './dto/expense.dto';
import { ExpensesService, type ListExpensesQuery } from './expenses.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Expenses')
@ApiBearerAuth('token')
@Controller('groups/:gid/expenses')
@UseGuards(GroupMemberGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  findAll(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Query() query: ListExpensesQuery,
  ): Promise<Expense[]> {
    return this.expenses.findAll(gid, query);
  }

  /**
   * @description Lists soft-deleted expenses. Must be declared before
   * `@Get(':eid')`: routes match in declaration order, and "deleted" would
   * otherwise be parsed as an id and rejected with 400.
   */
  @Get('deleted')
  findDeleted(@Param('gid', ParseUUIDPipe) gid: string): Promise<DeletedEntry[]> {
    return this.expenses.listDeleted(gid);
  }

  @Get(':eid')
  findOne(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Param('eid', ParseUUIDPipe) eid: string,
  ): Promise<Expense> {
    return this.expenses.findOne(gid, eid);
  }

  @Post()
  create(
    @Param('gid', ParseUUIDPipe) gid: string,
    @CurrentMember() me: MemberContext,
    @Body() body: CreateExpenseBody,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<Expense> {
    return this.expenses.create(gid, me.memberId, body, idempotencyKey ?? null);
  }

  @Patch(':eid')
  update(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Param('eid', ParseUUIDPipe) eid: string,
    @CurrentMember() me: MemberContext,
    @Body() body: UpdateExpenseBody,
  ): Promise<Expense> {
    return this.expenses.update(gid, eid, me.memberId, body);
  }

  @Delete(':eid')
  @HttpCode(204)
  remove(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Param('eid', ParseUUIDPipe) eid: string,
    @CurrentMember() me: MemberContext,
  ): Promise<void> {
    return this.expenses.remove(gid, eid, me.memberId);
  }

  /** Undoes a soft delete. */
  @Post(':eid/restore')
  restore(
    @Param('gid', ParseUUIDPipe) gid: string,
    @Param('eid', ParseUUIDPipe) eid: string,
    @CurrentMember() me: MemberContext,
  ): Promise<Expense> {
    return this.expenses.restore(gid, eid, me.memberId);
  }
}
