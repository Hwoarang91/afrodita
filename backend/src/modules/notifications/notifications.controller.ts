import { Controller, Get, Post, Delete, Body, UseGuards, Request, Query, Param } from '@nestjs/common';
import { AuthRequest } from '../../common/types/request.types';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery, ApiParam, ApiOkResponse } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationChannel } from '../../entities/notification.entity';
import { UserRole } from '../../entities/user.entity';
import { AuditAction } from '../../entities/audit-log.entity';
import { BroadcastDto } from './dto/broadcast.dto';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Получение уведомлений пользователя' })
  @ApiOkResponse({ description: 'Список уведомлений пользователя' })
  async getUserNotifications(@Request() req: AuthRequest) {
    return await this.notificationRepository.find({
      where: { userId: req.user!.sub! },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  @Post('broadcast')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Массовая рассылка сообщений (только для админов)' })
  @ApiBody({ type: BroadcastDto })
  async sendBroadcast(@Request() req: AuthRequest, @Body() dto: BroadcastDto) {
    const result = await this.notificationsService.sendBroadcast(
      dto.title,
      dto.message,
      dto.channel,
      {
        role: dto.role,
        userIds: dto.userIds,
      },
    );
    
    // Логируем действие
    await this.auditService.log(req.user!.sub!, AuditAction.BROADCAST_SENT, {
      entityType: 'broadcast',
      description: `Отправлена рассылка: ${dto.title} (канал: ${dto.channel}, получателей: ${result.total})`,
      changes: {
        channel: dto.channel,
        role: dto.role || 'all',
        total: result.total,
        sent: result.sent,
        failed: result.failed,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    return result;
  }

  @Get('broadcast/history')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'История рассылок (только для админов)' })
  @ApiOkResponse({ description: 'История рассылок с пагинацией' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Номер страницы' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Записей на странице' })
  async getBroadcastHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return await this.notificationsService.getBroadcastHistory(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('broadcast/:broadcastId/details')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Детали рассылки (только для админов)' })
  @ApiOkResponse({ description: 'Детали рассылки' })
  @ApiParam({ name: 'broadcastId', description: 'ID рассылки' })
  async getBroadcastDetails(@Param('broadcastId') broadcastId: string) {
    return await this.notificationsService.getBroadcastDetails(broadcastId);
  }

  @Get('broadcast/details')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Детали рассылки по ключу (только для админов)' })
  @ApiOkResponse({ description: 'Детали рассылки' })
  @ApiQuery({ name: 'title', required: true, type: String })
  @ApiQuery({ name: 'message', required: true, type: String })
  @ApiQuery({ name: 'channel', required: true, type: String })
  @ApiQuery({ name: 'createdAt', required: true, type: String })
  async getBroadcastDetailsByKey(
    @Query('title') title: string,
    @Query('message') message: string,
    @Query('channel') channel: string,
    @Query('createdAt') createdAt: string,
  ) {
    return await this.notificationsService.getBroadcastDetailsByKey(
      title,
      message,
      channel as NotificationChannel,
      createdAt,
    );
  }

  @Delete('batch')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Массовое удаление уведомлений (только для админов)' })
  @ApiBody({ schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } } } })
  async deleteNotifications(@Body() body: { ids: string[] }, @Request() req: AuthRequest) {
    const deleted = await this.notificationsService.deleteNotifications(body.ids);
    await this.auditService.log(req.user!.sub!, AuditAction.NOTIFICATION_DELETED, {
      entityType: 'notification',
      description: `Удалено ${deleted} уведомлений`,
      changes: { deletedCount: deleted, ids: body.ids },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return { success: true, message: `Удалено ${deleted} уведомлений`, deleted };
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Удаление уведомления (только для админов)' })
  @ApiParam({ name: 'id', description: 'ID уведомления' })
  async deleteNotification(@Param('id') id: string, @Request() req: AuthRequest) {
    await this.notificationsService.deleteNotification(id);
    await this.auditService.log(req.user!.sub!, AuditAction.NOTIFICATION_DELETED, {
      entityType: 'notification',
      entityId: id,
      description: `Удалено уведомление с ID: ${id}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    return { success: true, message: 'Уведомление удалено' };
  }
}

