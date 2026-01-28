import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramUserSession } from '../../entities/telegram-user-session.entity';
import { User } from '../../entities/user.entity';
import { TelegramUserController } from './controllers/telegram-user.controller';
import { TelegramUserClientService } from './services/telegram-user-client.service';
import { SessionEncryptionService } from './services/session-encryption.service';
import { TelegramSessionService } from './services/telegram-session.service';
import { TelegramHeartbeatService } from './services/telegram-heartbeat.service';
import { TelegramClientEventEmitter } from './services/telegram-client-event-emitter.service';
import { TelegramConnectionMonitorService } from './services/telegram-connection-monitor.service';
import { TelegramEventLoggerService } from './services/telegram-event-logger.service';
import { SessionCleanupService } from './services/session-cleanup.service';
import { TelegramSessionGuard } from './guards/telegram-session.guard';
import { UsersModule } from '../users/users.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([TelegramUserSession, User]),
    UsersModule,
    SettingsModule,
  ],
  controllers: [TelegramUserController],
  providers: [
    TelegramUserClientService,
    SessionEncryptionService,
    TelegramSessionService,
    TelegramHeartbeatService,
    TelegramClientEventEmitter,
    TelegramConnectionMonitorService,
    TelegramEventLoggerService,
    SessionCleanupService,
    TelegramSessionGuard,
  ],
  exports: [
    TelegramUserClientService,
    SessionEncryptionService,
    TelegramSessionService,
    TelegramHeartbeatService,
    TelegramClientEventEmitter,
    TelegramConnectionMonitorService,
    TelegramEventLoggerService,
  ],
})
export class TelegramUserApiModule {}
