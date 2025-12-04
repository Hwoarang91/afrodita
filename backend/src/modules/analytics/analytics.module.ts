import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { Appointment } from '../../entities/appointment.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Master } from '../../entities/master.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Appointment, Transaction, Master])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}

