import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpenseEntity, GroupEntity, MemberEntity, PaymentEntity } from '../../entities';
import { BalancesController } from './balances.controller';
import { BalancesService } from './balances.service';

@Module({
  imports: [TypeOrmModule.forFeature([GroupEntity, MemberEntity, ExpenseEntity, PaymentEntity])],
  controllers: [BalancesController],
  providers: [BalancesService],
  exports: [BalancesService], // Used by MembersService to block removing a member with an open balance
})
export class BalancesModule {}
