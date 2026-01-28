import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramController } from './telegram.controller';
import { TelegramChatsService } from './telegram-chats.service';
import { User } from '../../entities/user.entity';
import { Service } from '../../entities/service.entity';
import { Master } from '../../entities/master.entity';
import { Appointment } from '../../entities/appointment.entity';
import { TelegramChat } from '../../entities/telegram-chat.entity';
import { GroupSettings } from '../../entities/group-settings.entity';
import { AutoReply } from '../../entities/auto-reply.entity';
import { AutoRepliesService } from './auto-replies.service';
import { AutoRepliesController } from './auto-replies.controller';
import { ScheduledMessage } from '../../entities/scheduled-message.entity';
import { ScheduledMessagesService } from './scheduled-messages.service';
import { ScheduledMessagesController } from './scheduled-messages.controller';
import { UsersModule } from '../users/users.module';
import { ServicesModule } from '../services/services.module';
import { MastersModule } from '../masters/masters.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { FinancialModule } from '../financial/financial.module';
import { WebSocketModule } from '../websocket/websocket.module';

/** Модуль Telegram Bot API: бот, чаты, автоответы, запланированные сообщения. User API («от своего лица») — в TelegramUserApiModule. */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      User,
      Service,
      Master,
      Appointment,
      TelegramChat,
      GroupSettings,
      AutoReply,
      ScheduledMessage,
    ]),
    UsersModule,
    ServicesModule,
    MastersModule,
    forwardRef(() => AppointmentsModule),
    SettingsModule,
    forwardRef(() => NotificationsModule),
    ReviewsModule,
    FinancialModule,
    forwardRef(() => WebSocketModule),
  ],
  controllers: [TelegramController, AutoRepliesController, ScheduledMessagesController],
  providers: [
    TelegramService,
    TelegramBotService,
    TelegramChatsService,
    AutoRepliesService,
    ScheduledMessagesService,
  ],
  exports: [
    TelegramService,
    TelegramBotService,
    TelegramChatsService,
    AutoRepliesService,
    ScheduledMessagesService,
  ],
})
export class TelegramModule {}
