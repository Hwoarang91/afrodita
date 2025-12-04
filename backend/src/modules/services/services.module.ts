import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { Service } from '../../entities/service.entity';
import { Master } from '../../entities/master.entity';
import { CacheService } from '../../common/cache/cache.service';

@Module({
  imports: [TypeOrmModule.forFeature([Service, Master])],
  controllers: [ServicesController],
  providers: [ServicesService, CacheService],
  exports: [ServicesService],
})
export class ServicesModule {}

