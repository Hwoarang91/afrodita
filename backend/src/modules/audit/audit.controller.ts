import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { AuditAction } from '../../entities/audit-log.entity';

@ApiTags('audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Получение логов действий админов (только для админов)' })
  @ApiQuery({ name: 'userId', required: false, description: 'Фильтр по пользователю' })
  @ApiQuery({ name: 'action', required: false, enum: AuditAction, description: 'Фильтр по действию' })
  @ApiQuery({ name: 'entityType', required: false, description: 'Фильтр по типу сущности' })
  @ApiQuery({ name: 'entityId', required: false, description: 'Фильтр по ID сущности' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Начальная дата (ISO string)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Конечная дата (ISO string)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Лимит записей' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Смещение' })
  async getLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: AuditAction,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const filters: any = {};
    if (userId) filters.userId = userId;
    if (action) filters.action = action;
    if (entityType) filters.entityType = entityType;
    if (entityId) filters.entityId = entityId;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (limit) filters.limit = Number(limit);
    if (offset) filters.offset = Number(offset);

    return await this.auditService.findAll(filters);
  }

  @Get('entity/:entityType/:entityId')
  @ApiOperation({ summary: 'Получение логов для конкретной сущности (только для админов)' })
  async getEntityLogs(
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return await this.auditService.findByEntity(entityType, entityId);
  }
}

