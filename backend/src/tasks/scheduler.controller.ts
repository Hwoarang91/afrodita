import { Controller, Post, UseGuards, Request, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../entities/user.entity';

@ApiTags('scheduler')
@Controller('scheduler')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class SchedulerController {
  private readonly logger = new Logger(SchedulerController.name);

  constructor(private readonly schedulerService: SchedulerService) {
    this.logger.log('SchedulerController создан');
    // Принудительная инициализация - вызываем метод для гарантии создания сервиса
    // Это должно вызвать lifecycle hooks
    setTimeout(() => {
      this.logger.log('Проверка инициализации SchedulerService...');
      // Просто обращаемся к сервису, чтобы гарантировать его создание
      if (this.schedulerService) {
        this.logger.log('SchedulerService доступен');
      }
    }, 1000);
  }

  @Post('reminders/trigger')
  @ApiOperation({ summary: 'Ручной запуск проверки напоминаний (только для админов)' })
  async triggerReminders(@Request() _req: any) {
    await this.schedulerService.sendAppointmentReminders();
    return { success: true, message: 'Проверка напоминаний запущена' };
  }
}

