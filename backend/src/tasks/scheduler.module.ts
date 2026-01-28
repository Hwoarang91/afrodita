import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { Appointment } from '../entities/appointment.entity';
import { Notification } from '../entities/notification.entity';
import { User } from '../entities/user.entity';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { FinancialModule } from '../modules/financial/financial.module';
import { SettingsModule } from '../modules/settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, Notification, User]),
    NotificationsModule,
    FinancialModule,
    SettingsModule,
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}

