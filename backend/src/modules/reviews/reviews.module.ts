import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { Review } from '../../entities/review.entity';
import { Appointment } from '../../entities/appointment.entity';
import { Master } from '../../entities/master.entity';
import { Service } from '../../entities/service.entity';
import { User } from '../../entities/user.entity';
import { FinancialModule } from '../financial/financial.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, Appointment, Master, Service, User]),
    FinancialModule,
    SettingsModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}

