import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MastersService } from './masters.service';
import { MastersController } from './masters.controller';
import { Master } from '../../entities/master.entity';
import { Service } from '../../entities/service.entity';
import { WorkSchedule } from '../../entities/work-schedule.entity';
import { BlockInterval } from '../../entities/block-interval.entity';
import { Appointment } from '../../entities/appointment.entity';
import { AuditModule } from '../audit/audit.module';
import { CacheService } from '../../common/cache/cache.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Master, Service, WorkSchedule, BlockInterval, Appointment]),
    AuditModule,
  ],
  controllers: [MastersController],
  providers: [MastersService, CacheService],
  exports: [MastersService],
})
export class MastersModule {}

