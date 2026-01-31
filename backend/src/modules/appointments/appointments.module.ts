import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { Appointment } from '../../entities/appointment.entity';
import { Master } from '../../entities/master.entity';
import { Service } from '../../entities/service.entity';
import { WorkSchedule } from '../../entities/work-schedule.entity';
import { BlockInterval } from '../../entities/block-interval.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { FinancialModule } from '../financial/financial.module';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { TelegramModule } from '../telegram/telegram.module';
import { ExtraServicesModule } from '../extra-services/extra-services.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      Master,
      Service,
      WorkSchedule,
      BlockInterval,
    ]),
    NotificationsModule,
    FinancialModule,
    AuditModule,
    SettingsModule,
    ExtraServicesModule,
    forwardRef(() => TelegramModule),
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}

