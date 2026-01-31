import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExtraService } from '../../entities/extra-service.entity';
import { ExtraServicesService } from './extra-services.service';
import { ExtraServicesController } from './extra-services.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ExtraService])],
  controllers: [ExtraServicesController],
  providers: [ExtraServicesService],
  exports: [ExtraServicesService],
})
export class ExtraServicesModule {}
