import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CategoryEntity, ExpenseEntity, GroupEntity, MemberEntity, PaymentEntity,
} from '../../entities';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GroupEntity, MemberEntity, ExpenseEntity, PaymentEntity, CategoryEntity,
    ]),
  ],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
