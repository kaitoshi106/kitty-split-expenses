import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupEntity, GroupSessionEntity } from '../../entities';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  imports: [TypeOrmModule.forFeature([GroupEntity, GroupSessionEntity])],
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
