import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Получение статистики для дашборда' })
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
  @ApiQuery({ name: 'masterId', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
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

