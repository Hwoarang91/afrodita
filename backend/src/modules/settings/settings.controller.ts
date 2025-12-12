import { Controller, Get, Put, Body, UseGuards, Request, Logger, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';
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
    private readonly usersService: UsersService,
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

  @Get('verified-users')
  @ApiOperation({ summary: 'Получить список верифицированных пользователей (с telegramId)' })
  async getVerifiedUsers() {
    const { data: users } = await this.usersService.findAll(undefined, undefined, 1, 1000);
    
    // Фильтруем только пользователей с telegramId (верифицированных через Telegram бота)
    const verifiedUsers = users
      .filter(user => user.telegramId !== null && user.telegramId !== undefined)
      .map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        phone: user.phone,
        telegramId: user.telegramId,
        role: user.role,
        createdAt: user.createdAt,
      }))
      .sort((a, b) => {
        // Сортируем по дате создания (новые сначала)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    return { data: verifiedUsers };
  }

  @Get('telegram-admin-user')
  @ApiOperation({ summary: 'Получить ID администратора Telegram бота' })
  async getTelegramAdminUser() {
    const userId = await this.settingsService.getTelegramAdminUserId();
    
    if (!userId) {
      return { value: null };
    }

    try {
      const user = await this.usersService.findById(userId);
      return {
        value: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          phone: user.phone,
          telegramId: user.telegramId,
        },
      };
    } catch (error) {
      // Если пользователь не найден, возвращаем null
      await this.settingsService.setTelegramAdminUserId(null);
      return { value: null };
    }
  }

  @Put('telegram-admin-user')
  @ApiOperation({ summary: 'Установить администратора Telegram бота и веб-приложения' })
  async setTelegramAdminUser(@Request() req, @Body() body: { userId: string | null }) {
    if (body.userId) {
      // Проверяем, что пользователь существует и имеет telegramId
      const user = await this.usersService.findById(body.userId);
      
      if (!user.telegramId) {
        throw new BadRequestException('Пользователь не прошел верификацию через Telegram бота');
      }
    }

    const oldUserId = await this.settingsService.getTelegramAdminUserId();
    await this.settingsService.setTelegramAdminUserId(body.userId);
    
    await this.auditService.log(req.user.sub, AuditAction.SETTINGS_UPDATED, {
      entityType: 'settings',
      entityId: 'telegramAdminUserId',
      description: 'Обновлен администратор Telegram бота и веб-приложения',
      changes: { old: oldUserId, new: body.userId },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    if (body.userId) {
      const user = await this.usersService.findById(body.userId);
      return {
        success: true,
        value: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          phone: user.phone,
          telegramId: user.telegramId,
        },
      };
    }

    return { success: true, value: null };
  }
}

