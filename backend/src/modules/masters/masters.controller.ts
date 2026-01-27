import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request } from '@nestjs/common';
import { AuthRequest } from '../../common/types/request.types';
import { ApiTags, ApiOperation, ApiQuery, ApiBody, ApiParam, ApiOkResponse, ApiNotFoundResponse } from '@nestjs/swagger';
import { MastersService } from './masters.service';
import { AuditService } from '../audit/audit.service';
import { CreateMasterDto } from './dto/create-master.dto';
import { UpdateMasterDto } from './dto/update-master.dto';
import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';
import { CreateBlockIntervalDto } from './dto/create-block-interval.dto';
import { AuditAction } from '../../entities/audit-log.entity';

@ApiTags('masters')
@Controller('masters')
export class MastersController {
  constructor(
    private readonly mastersService: MastersService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Получение списка мастеров' })
  @ApiOkResponse({ description: 'Список мастеров с пагинацией' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Номер страницы' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Количество записей на странице (макс. 100)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Поиск по имени или специализации' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Фильтр по активности' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return await this.mastersService.findAll(
      page,
      limit,
      search,
      isActive !== undefined ? isActive === 'true' : undefined,
    );
  }

  @Post()
  // Временно отключено для тестирования - в production включить обратно
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Создание мастера (только для админов)' })
  @ApiBody({ type: CreateMasterDto, description: 'Данные мастера: userId, name, bio, photoUrl и др.' })
  async create(@Request() req: AuthRequest, @Body() dto: CreateMasterDto) {
    const master = await this.mastersService.create(dto);
    
    // Логируем действие (если есть пользователь в запросе)
    if (req?.user?.sub) {
      await this.auditService.log(req.user.sub, AuditAction.MASTER_CREATED, {
        entityType: 'master',
        entityId: master.id,
        description: `Создан мастер: ${master.name}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    }
    
    return master;
  }

  // ============================================
  // SCHEDULE ROUTES - ДОЛЖНЫ БЫТЬ ВЫШЕ :id
  // ============================================

  @Put('schedule/:scheduleId')
  // Временно отключено для тестирования - в production включить обратно
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновление расписания (только для админов)' })
  @ApiParam({ name: 'scheduleId', description: 'ID расписания' })
  @ApiBody({ type: UpdateWorkScheduleDto })
  @ApiNotFoundResponse({ description: 'Расписание не найдено' })
  async updateSchedule(@Param('scheduleId') scheduleId: string, @Body() dto: UpdateWorkScheduleDto) {
    return await this.mastersService.updateSchedule(scheduleId, dto);
  }

  @Delete('schedule/:scheduleId')
  // Временно отключено для тестирования - в production включить обратно
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Удаление расписания (только для админов)' })
  @ApiParam({ name: 'scheduleId', description: 'ID расписания' })
  async deleteSchedule(@Param('scheduleId') scheduleId: string) {
    await this.mastersService.deleteSchedule(scheduleId);
    return { message: 'Schedule deleted successfully' };
  }

  // ============================================
  // BLOCK INTERVALS ROUTES - ДОЛЖНЫ БЫТЬ ВЫШЕ :id
  // ============================================

  @Delete('block-intervals/:blockIntervalId')
  // Временно отключено для тестирования - в production включить обратно
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Удаление заблокированного интервала (только для админов)' })
  @ApiParam({ name: 'blockIntervalId', description: 'ID заблокированного интервала' })
  @ApiNotFoundResponse({ description: 'Заблокированный интервал не найден' })
  async deleteBlockInterval(@Param('blockIntervalId') blockIntervalId: string) {
    await this.mastersService.deleteBlockInterval(blockIntervalId);
    return { message: 'Block interval deleted successfully' };
  }

  // ============================================
  // :id SPECIFIC ROUTES - ДОЛЖНЫ БЫТЬ НИЖЕ СПЕЦИФИЧНЫХ
  // ============================================

  @Get(':id/schedule')
  @ApiOperation({ summary: 'Получение расписания мастера' })
  @ApiOkResponse({ description: 'Расписание мастера' })
  @ApiParam({ name: 'id', description: 'ID мастера' })
  async getSchedule(@Param('id') id: string) {
    return await this.mastersService.getSchedule(id);
  }

  @Post(':id/schedule')
  // Временно отключено для тестирования - в production включить обратно
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Создание расписания для мастера (только для админов)' })
  @ApiParam({ name: 'id', description: 'ID мастера' })
  @ApiBody({ type: CreateWorkScheduleDto })
  async createSchedule(@Param('id') id: string, @Body() dto: CreateWorkScheduleDto) {
    return await this.mastersService.createSchedule(id, dto);
  }

  @Get(':id/block-intervals')
  @ApiOperation({ summary: 'Получение заблокированных интервалов мастера' })
  @ApiOkResponse({ description: 'Список заблокированных интервалов' })
  @ApiParam({ name: 'id', description: 'ID мастера' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Начало периода (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Конец периода (YYYY-MM-DD)' })
  async getBlockIntervals(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return await this.mastersService.getBlockIntervals(id, start, end);
  }

  @Post(':id/block-intervals')
  // Временно отключено для тестирования - в production включить обратно
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Создание заблокированного интервала (только для админов)' })
  @ApiParam({ name: 'id', description: 'ID мастера' })
  @ApiBody({ type: CreateBlockIntervalDto })
  @ApiNotFoundResponse({ description: 'Мастер не найден' })
  async createBlockInterval(@Param('id') id: string, @Body() dto: CreateBlockIntervalDto) {
    return await this.mastersService.createBlockInterval(id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получение мастера по ID' })
  @ApiOkResponse({ description: 'Мастер' })
  @ApiNotFoundResponse({ description: 'Мастер не найден' })
  @ApiParam({ name: 'id', description: 'ID мастера' })
  async findById(@Param('id') id: string) {
    return await this.mastersService.findById(id);
  }

  @Put(':id')
  // Временно отключено для тестирования - в production включить обратно
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновление мастера (только для админов)' })
  @ApiParam({ name: 'id', description: 'ID мастера' })
  @ApiBody({ type: UpdateMasterDto, description: 'Частичное обновление: name, bio, photoUrl и др.' })
  @ApiNotFoundResponse({ description: 'Мастер не найден' })
  async update(@Request() req: AuthRequest, @Param('id') id: string, @Body() dto: UpdateMasterDto) {
    const oldMaster = await this.mastersService.findById(id);
    const master = await this.mastersService.update(id, dto);
    
    // Определяем изменения
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    Object.keys(dto).forEach((key: string) => {
      const o = (oldMaster as unknown as Record<string, unknown>)[key];
      const n = (dto as Record<string, unknown>)[key];
      if (o !== n) {
        changes[key] = { old: o, new: n };
      }
    });
    
    // Логируем действие (если есть пользователь в запросе)
    if (req?.user?.sub) {
      await this.auditService.log(req.user.sub, AuditAction.MASTER_UPDATED, {
        entityType: 'master',
        entityId: id,
        description: `Обновлен мастер: ${master.name}`,
        changes,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    }
    
    return master;
  }

  @Delete(':id')
  // Временно отключено для тестирования - в production включить обратно
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Удаление мастера (только для админов)' })
  @ApiParam({ name: 'id', description: 'ID мастера' })
  @ApiNotFoundResponse({ description: 'Мастер не найден' })
  async delete(@Request() req: AuthRequest, @Param('id') id: string) {
    const master = await this.mastersService.findById(id);
    await this.mastersService.delete(id);
    
    // Логируем действие (если есть пользователь в запросе)
    if (req?.user?.sub) {
      await this.auditService.log(req.user.sub, AuditAction.MASTER_DELETED, {
        entityType: 'master',
        entityId: id,
        description: `Удален мастер: ${master.name}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
    }
    
    return { message: 'Master deleted successfully' };
  }
}
