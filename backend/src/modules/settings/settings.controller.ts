import { Controller, Get, Put, Body, UseGuards, Request, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { AuditAction } from '../../entities/audit-log.entity';

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class SettingsController {
  private readonly logger = new Logger(SettingsController.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Получение всех настроек' })
  async getSettings() {
    const bookingSettings = await this.settingsService.getBookingSettings();
    return {
      bookingSettings,
    };
  }

  @Put()
  @ApiOperation({ summary: 'Обновление настроек' })
  async updateSettings(@Request() req, @Body() body: { bookingSettings?: any }) {
    this.logger.debug('Получен запрос на обновление настроек');
    
    // Получаем старые настройки для логирования изменений
    const oldSettings = await this.settingsService.getBookingSettings();
    
    if (body.bookingSettings) {
      const result = await this.settingsService.setBookingSettings(body.bookingSettings);
      this.logger.log('Настройки bookingSettings успешно обновлены');
      
      // Определяем изменения
      const changes: Record<string, any> = {};
      Object.keys(body.bookingSettings).forEach((key) => {
        if (oldSettings[key] !== body.bookingSettings[key]) {
          changes[key] = { old: oldSettings[key], new: body.bookingSettings[key] };
        }
      });
      
      // Логируем действие
      await this.auditService.log(req.user.sub, AuditAction.SETTINGS_UPDATED, {
        entityType: 'settings',
        entityId: 'bookingSettings',
        description: 'Обновлены настройки бронирования',
        changes,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      return { success: true, bookingSettings: result.value };
    }
    return { success: true };
  }

  @Get('telegram-auto-refresh-interval')
  @ApiOperation({ summary: 'Получить интервал автоматического обновления чатов' })
  async getAutoRefreshInterval() {
    const interval = await this.settingsService.get('telegramAutoRefreshInterval', 60);
    return { value: interval };
  }

  @Put('telegram-auto-refresh-interval')
  @ApiOperation({ summary: 'Установить интервал автоматического обновления чатов' })
  async setAutoRefreshInterval(@Request() req, @Body() body: { value: number }) {
    await this.settingsService.set('telegramAutoRefreshInterval', body.value);
    
    await this.auditService.log(req.user.sub, AuditAction.SETTINGS_UPDATED, {
      entityType: 'settings',
      entityId: 'telegramAutoRefreshInterval',
      description: 'Обновлен интервал автоматического обновления чатов',
      changes: { value: body.value },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    return { success: true, value: body.value };
  }

  @Get('timezone')
  @ApiOperation({ summary: 'Получить часовой пояс' })
  async getTimezone() {
    const timezone = await this.settingsService.get('timezone', 'Europe/Moscow');
    return { value: timezone };
  }

  @Put('timezone')
  @ApiOperation({ summary: 'Установить часовой пояс' })
  async setTimezone(@Request() req, @Body() body: { value: string }) {
    await this.settingsService.set('timezone', body.value);
    
    await this.auditService.log(req.user.sub, AuditAction.SETTINGS_UPDATED, {
      entityType: 'settings',
      entityId: 'timezone',
      description: 'Обновлен часовой пояс',
      changes: { value: body.value },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    return { success: true, value: body.value };
  }

  @Get('working-hours')
  @ApiOperation({ summary: 'Получить рабочие часы' })
  async getWorkingHours() {
    const workingHours = await this.settingsService.get('workingHours', { start: '09:00', end: '21:00' });
    return { value: workingHours };
  }

  @Put('working-hours')
  @ApiOperation({ summary: 'Установить рабочие часы' })
  async setWorkingHours(@Request() req, @Body() body: { value: { start: string; end: string } }) {
    await this.settingsService.set('workingHours', body.value);
    
    await this.auditService.log(req.user.sub, AuditAction.SETTINGS_UPDATED, {
      entityType: 'settings',
      entityId: 'workingHours',
      description: 'Обновлены рабочие часы',
      changes: { value: body.value },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    return { success: true, value: body.value };
  }

  @Get('reminder-intervals')
  @ApiOperation({ summary: 'Получить интервалы напоминаний' })
  async getReminderIntervals() {
    const intervals = await this.settingsService.get('reminderIntervals', [24, 2]);
    return { value: intervals };
  }

  @Put('reminder-intervals')
  @ApiOperation({ summary: 'Установить интервалы напоминаний' })
  async setReminderIntervals(@Request() req, @Body() body: { value: number[] }) {
    this.logger.debug('Получен запрос на обновление интервалов напоминаний');
    
    const result = await this.settingsService.set('reminderIntervals', body.value);
    this.logger.log('Интервалы напоминаний успешно сохранены');
    
    await this.auditService.log(req.user.sub, AuditAction.SETTINGS_UPDATED, {
      entityType: 'settings',
      entityId: 'reminderIntervals',
      description: 'Обновлены интервалы напоминаний о записях',
      changes: { value: body.value },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    return { success: true, value: body.value };
  }

  @Get('first-visit-discount')
  @ApiOperation({ summary: 'Получить настройки скидки на первый визит' })
  async getFirstVisitDiscount() {
    const settings = await this.settingsService.getFirstVisitDiscountSettings();
    return { value: settings };
  }

  @Put('first-visit-discount')
  @ApiOperation({ summary: 'Установить настройки скидки на первый визит' })
  async setFirstVisitDiscount(@Request() req, @Body() body: { value: { enabled: boolean; type: 'percent' | 'fixed'; value: number } }) {
    const result = await this.settingsService.setFirstVisitDiscountSettings(body.value);
    
    await this.auditService.log(req.user.sub, AuditAction.SETTINGS_UPDATED, {
      entityType: 'settings',
      entityId: 'firstVisitDiscount',
      description: 'Обновлены настройки скидки на первый визит',
      changes: { value: body.value },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    return { success: true, value: result.value };
  }
}

