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
import { UsersModule } from '../users/users.module';
import { ServicesModule } from '../services/services.module';
import { MastersModule } from '../masters/masters.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { FinancialModule } from '../financial/financial.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, Service, Master, Appointment, TelegramChat, GroupSettings]),
    UsersModule,
    ServicesModule,
    MastersModule,
    forwardRef(() => AppointmentsModule),
    SettingsModule,
    forwardRef(() => NotificationsModule),
    ReviewsModule,
    FinancialModule,
  ],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramBotService, TelegramChatsService],
  exports: [TelegramService, TelegramBotService, TelegramChatsService],
})
export class TelegramModule {}

