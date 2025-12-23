import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { Appointment } from '../entities/appointment.entity';
import { Service } from '../entities/service.entity';
import { Notification } from '../entities/notification.entity';
import { User } from '../entities/user.entity';
import { TelegramUserSession } from '../entities/telegram-user-session.entity';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { FinancialModule } from '../modules/financial/financial.module';
import { SettingsModule } from '../modules/settings/settings.module';
import { TelegramModule } from '../modules/telegram/telegram.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, Service, Notification, User, TelegramUserSession]),
    NotificationsModule,
    FinancialModule,
    SettingsModule,
    TelegramModule, // Импортируем TelegramModule для доступа к TelegramUserSessionRepository
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}

