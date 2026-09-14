import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupEntity, MemberEntity } from '../../entities';
import { BalancesModule } from '../balances/balances.module';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  imports: [TypeOrmModule.forFeature([MemberEntity, GroupEntity]), BalancesModule],
  controllers: [MembersController],
  providers: [MembersService],
})
export class MembersModule {}
