import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberEntity, PaymentEntity } from '../../entities';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentEntity, MemberEntity])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
