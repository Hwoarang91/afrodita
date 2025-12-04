import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { ServicesModule } from './modules/services/services.module';
import { MastersModule } from './modules/masters/masters.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FinancialModule } from './modules/financial/financial.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AuditModule } from './modules/audit/audit.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { DatabaseConfig } from './config/database.config';
import { SchedulerModule } from './tasks/scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'], // Ищем .env в корне проекта
    }),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    AppointmentsModule,
    ServicesModule,
    MastersModule,
    NotificationsModule,
    FinancialModule,
    TelegramModule,
    WebSocketModule,
    AnalyticsModule,
    SettingsModule,
    AuditModule,
    ReviewsModule,
    TemplatesModule,
    SchedulerModule,
  ],
})
export class AppModule {}
