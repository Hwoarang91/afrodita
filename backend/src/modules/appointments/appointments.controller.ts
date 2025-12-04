import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { AppointmentStatus } from '../../entities/appointment.entity';
import { AuditAction } from '../../entities/audit-log.entity';

@ApiTags('appointments')
@Controller('appointments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Создание новой записи' })
  async create(@Body() dto: CreateAppointmentDto, @Request() req) {
    return await this.appointmentsService.create(dto, req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Получение списка записей' })
  @ApiQuery({ name: 'status', required: false, enum: AppointmentStatus })
  @ApiQuery({ name: 'date', required: false, description: 'Фильтр по дате (YYYY-MM-DD)' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Начало диапазона дат (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Конец диапазона дат (YYYY-MM-DD)' })
  @ApiQuery({ name: 'masterId', required: false, description: 'Фильтр по мастеру' })
  async findAll(
    @Query('status') status: AppointmentStatus,
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('masterId') masterId?: string,
    @Request() req?: any,
  ) {
    // Для админов возвращаем все записи, для обычных пользователей - только свои
    const userId = req?.user?.role === 'admin' ? undefined : req?.user?.sub;
    return await this.appointmentsService.findAll(userId, status, date, startDate, endDate, masterId);
  }

  @Get('slots')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получение доступных слотов' })
  @ApiQuery({ name: 'masterId', required: true })
  @ApiQuery({ name: 'serviceId', required: true })
  @ApiQuery({ name: 'date', required: true })
  async getAvailableSlots(
    @Query('masterId') masterId: string,
    @Query('serviceId') serviceId: string,
    @Query('date') date: string,
  ) {
    const slots = await this.appointmentsService.getAvailableSlots(
      masterId,
      serviceId,
      new Date(date),
    );
    // Преобразуем Date[] в строки ISO для фронтенда
    return slots.map((slot: Date) => slot.toISOString());
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получение записи по ID' })
  async findById(@Param('id') id: string, @Request() req) {
    // Для админов не проверяем userId
    const userId = req?.user?.role === 'admin' ? undefined : req?.user?.sub;
    return await this.appointmentsService.findById(id, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновление записи' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @Request() req,
  ) {
    // Для админов не проверяем userId
    const userId = req?.user?.role === 'admin' ? undefined : req?.user?.sub;
    return await this.appointmentsService.update(id, dto, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Частичное обновление записи (например, статуса)' })
  async patch(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
    @Request() req,
  ) {
    // Для админов не проверяем userId
    const userId = req?.user?.role === 'admin' ? undefined : req?.user?.sub;
    return await this.appointmentsService.update(id, dto, userId);
  }

  @Patch(':id/reschedule')
  @ApiOperation({ summary: 'Перенос записи на другое время' })
  async reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
    @Request() req,
  ) {
    return await this.appointmentsService.reschedule(
      id,
      new Date(dto.startTime),
      req.user.sub,
      dto.reason,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Отмена записи' })
  async cancel(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req,
  ) {
    return await this.appointmentsService.cancel(id, req.user.sub, reason);
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Подтверждение записи (только для админов)' })
  async confirm(@Param('id') id: string, @Request() req) {
    // Только админы могут подтверждать записи
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    const appointment = await this.appointmentsService.confirm(id);
    
    // Логируем действие
    await this.auditService.log(req.user.sub, AuditAction.APPOINTMENT_CONFIRMED, {
      entityType: 'appointment',
      entityId: id,
      description: `Подтверждена запись #${id}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    return appointment;
  }

  @Post(':id/cancel-admin')
  @ApiOperation({ summary: 'Отмена записи админом с причиной (только для админов)' })
  async cancelByAdmin(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req,
  ) {
    // Только админы могут отменять записи
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    const appointment = await this.appointmentsService.cancelByAdmin(id, body.reason);
    
    // Логируем действие
    await this.auditService.log(req.user.sub, AuditAction.APPOINTMENT_CANCELLED, {
      entityType: 'appointment',
      entityId: id,
      description: `Отменена запись #${id}${body.reason ? `. Причина: ${body.reason}` : ''}`,
      changes: body.reason ? { cancellationReason: body.reason } : undefined,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    return appointment;
  }

  @Delete(':id/delete')
  @ApiOperation({ summary: 'Удаление записи (только для админов)' })
  async delete(@Param('id') id: string, @Request() req) {
    // Только админы могут удалять записи
    if (req?.user?.role !== 'admin') {
      throw new Error('Access denied');
    }
    return await this.appointmentsService.delete(id);
  }
}

