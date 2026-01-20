import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ReferralService } from './referral.service';
import { User } from '../../entities/user.entity';
import { Appointment } from '../../entities/appointment.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Notification } from '../../entities/notification.entity';
import { BodyMeasurement } from '../../entities/body-measurement.entity';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { FinancialModule } from '../financial/financial.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Appointment, Transaction, Notification, BodyMeasurement]),
    AuditModule,
    forwardRef(() => SettingsModule),
    FinancialModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, ReferralService],
  exports: [UsersService, ReferralService],
})
export class UsersModule {}

