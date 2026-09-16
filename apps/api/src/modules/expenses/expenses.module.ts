import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ExpenseEntity, ExpensePayerEntity, ExpenseShareEntity, MemberEntity,
} from '../../entities';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExpenseEntity, ExpensePayerEntity, ExpenseShareEntity, MemberEntity,
    ]),
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService],
})
export class ExpensesModule {}
