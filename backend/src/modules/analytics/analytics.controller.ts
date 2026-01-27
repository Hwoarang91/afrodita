import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiOkResponse } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Получение статистики для дашборда' })
  @ApiOkResponse({ description: 'Статистика дашборда' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Начало периода (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Конец периода (YYYY-MM-DD)' })
  async getDashboardStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return await this.analyticsService.getDashboardStats(
      startDate ? new Date(startDate + 'T00:00:00.000Z') : undefined,
      endDate ? new Date(endDate + 'T23:59:59.999Z') : undefined,
    );
  }

  @Get('master-load')
  @ApiOperation({ summary: 'Загрузка мастера' })
  @ApiOkResponse({ description: 'Загрузка мастера по датам' })
  @ApiQuery({ name: 'masterId', required: true, description: 'ID мастера' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Начало периода (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, description: 'Конец периода (YYYY-MM-DD)' })
  async getMasterLoad(
    @Query('masterId') masterId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return await this.analyticsService.getMasterLoad(
      masterId,
      new Date(startDate),
      new Date(endDate),
    );
  }
}

