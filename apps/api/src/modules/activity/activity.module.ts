import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLogEntity } from '../../entities';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';

/** Global because every feature module writes activity entries. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ActivityLogEntity])],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
