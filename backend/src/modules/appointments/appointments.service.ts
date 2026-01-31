import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual } from 'typeorm';
import { Appointment, AppointmentStatus } from '../../entities/appointment.entity';
import { Master } from '../../entities/master.entity';
import { Service } from '../../entities/service.entity';
import { WorkSchedule, DayOfWeek } from '../../entities/work-schedule.entity';
import { BlockInterval } from '../../entities/block-interval.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { FinancialService } from '../financial/financial.service';
import { SettingsService } from '../settings/settings.service';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { ExtraServicesService } from '../extra-services/extra-services.service';
import { ErrorCode } from '../../common/interfaces/error-response.interface';
import { buildErrorResponse } from '../../common/utils/error-response.builder';
import { getErrorMessage, getErrorStack } from '../../common/utils/error-message';
import { normalizePagination } from '../../common/dto/pagination.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(Master)
    private masterRepository: Repository<Master>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(WorkSchedule)
    private workScheduleRepository: Repository<WorkSchedule>,
    @InjectRepository(BlockInterval)
    private blockIntervalRepository: Repository<BlockInterval>,
    private notificationsService: NotificationsService,
    private financialService: FinancialService,
    private settingsService: SettingsService,
    @Inject(forwardRef(() => TelegramBotService))
    private telegramBotService: TelegramBotService,
    private extraServicesService: ExtraServicesService,
  ) {}

  async create(dto: CreateAppointmentDto, userId: string): Promise<Appointment> {
    const master = await this.masterRepository.findOne({
      where: { id: dto.masterId },
      relations: ['services'],
    });
    if (!master) {
      throw new NotFoundException('Master not found');
    }

    const service = await this.serviceRepository.findOne({
      where: { id: dto.serviceId },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Проверка активности мастера
    if (!master.isActive) {
      throw new BadRequestException(
        buildErrorResponse(400, ErrorCode.VALIDATION_ERROR, 'Master is not active')
      );
    }

    // Проверка активности услуги
    if (!service.isActive) {
      throw new BadRequestException(
        buildErrorResponse(400, ErrorCode.VALIDATION_ERROR, 'Service is not active')
      );
    }

    // Проверка доступности мастера для услуги
    if (!master.services.some((s) => s.id === service.id)) {
      throw new BadRequestException(
        buildErrorResponse(400, ErrorCode.VALIDATION_ERROR, 'Master does not provide this service')
      );
    }

    const startTime = new Date(dto.startTime);
    const endTime = new Date(startTime.getTime() + service.duration * 60000);

    // Проверка что время не в прошлом
    const now = new Date();
    if (startTime < now) {
      throw new BadRequestException('Cannot create appointment in the past');
    }

    // Проверка доступности времени
    await this.validateTimeSlot(master.id, startTime, endTime);

    // Проверка, является ли это первым визитом пользователя
    const existingAppointments = await this.appointmentRepository.count({
      where: { clientId: userId },
    });
    const isFirstVisit = existingAppointments === 0;

    // Получаем настройки скидки на первый визит
    const discountSettings = await this.settingsService.getFirstVisitDiscountSettings();
    let discount = 0;
    let finalPrice = Number(service.price);

    // Доп. услуги: загрузка и сумма
    const extraServiceIds = dto.extraServiceIds?.filter(Boolean) ?? [];
    let extraServicesTotal = 0;
    const extraServicesList: { id: string }[] = [];
    if (extraServiceIds.length > 0) {
      const extraServices = await this.extraServicesService.findByIds(extraServiceIds);
      if (extraServices.length !== extraServiceIds.length) {
        throw new BadRequestException(
          buildErrorResponse(400, ErrorCode.VALIDATION_ERROR, 'One or more extra services not found or inactive'),
        );
      }
      for (const es of extraServices) {
        if (!es.isActive) {
          throw new BadRequestException(
            buildErrorResponse(400, ErrorCode.VALIDATION_ERROR, `Extra service "${es.name}" is not active`),
          );
        }
        extraServicesTotal += Number(es.price);
        extraServicesList.push({ id: es.id });
      }
    }

    // Если скидка уже предрассчитана (для комплекса услуг), используем её
    if (dto.discount !== undefined && dto.discount > 0) {
      discount = dto.discount;
      finalPrice = service.price - discount;
    } else if (isFirstVisit && discountSettings.enabled) {
      // Если это первый визит и скидка не была предрассчитана, применяем стандартную логику
      if (discountSettings.type === 'percent') {
        discount = (Number(service.price) * discountSettings.value) / 100;
      } else {
        discount = discountSettings.value;
      }
      discount = Math.min(discount, Number(service.price));
      finalPrice = Number(service.price) - discount;
    }
    finalPrice += extraServicesTotal;

    // Создание записи
    const appointment = this.appointmentRepository.create({
      clientId: userId,
      masterId: dto.masterId,
      serviceId: dto.serviceId,
      startTime,
      endTime,
      price: finalPrice,
      discount: discount > 0 ? discount : undefined,
      status: AppointmentStatus.PENDING,
      notes: dto.notes,
    });

    const savedAppointment = await this.appointmentRepository.save(appointment);
    if (Array.isArray(savedAppointment)) {
      throw new InternalServerErrorException('Unexpected array returned from save');
    }

    if (extraServicesList.length > 0) {
      await this.appointmentRepository
        .createQueryBuilder()
        .relation(Appointment, 'extraServices')
        .of(savedAppointment)
        .add(extraServicesList.map((e) => e.id));
    }

    // Отправка уведомления только если запись подтверждена
    // Если статус PENDING, уведомление не отправляется (будет отправлено при подтверждении админом)
    if (savedAppointment.status === AppointmentStatus.CONFIRMED) {
      await this.notificationsService.sendAppointmentConfirmation(savedAppointment);
    }

    // Отправка уведомления админам о новой записи (всегда, независимо от статуса)
    try {
      await this.telegramBotService.notifyAdminsAboutNewAppointment(savedAppointment);
    } catch (error: unknown) {
      this.logger.error(`Ошибка при отправке уведомления админам о новой записи: ${getErrorMessage(error)}`, getErrorStack(error));
    }

    // Отправка уведомления мастеру о новой записи (всегда, независимо от статуса)
    try {
      await this.telegramBotService.notifyMasterAboutNewAppointment(savedAppointment);
    } catch (error: unknown) {
      this.logger.error(`Ошибка при отправке уведомления мастеру о новой записи: ${getErrorMessage(error)}`, getErrorStack(error));
    }

    return savedAppointment;
  }

  async findAll(
    userId?: string,
    status?: AppointmentStatus,
    date?: string,
    startDate?: string,
    endDate?: string,
    masterId?: string,
    page?: number | string,
    limit?: number | string,
  ): Promise<{ data: Appointment[]; total: number; page: number; limit: number; totalPages: number }> {
    const { page: p, limit: l } = normalizePagination(page, limit);

    const query = this.appointmentRepository.createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.master', 'master')
      .leftJoinAndSelect('appointment.service', 'service')
      .leftJoinAndSelect('appointment.client', 'client');

    // Строим условия WHERE динамически
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (userId) {
      conditions.push('appointment.clientId = :userId');
      params.userId = userId;
    }

    if (status) {
      conditions.push('appointment.status = :status');
      params.status = status;
    }

    if (masterId) {
      conditions.push('appointment.masterId = :masterId');
      params.masterId = masterId;
    }
    // Обработка фильтрации по дате
    if (startDate && endDate) {
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T23:59:59.999');
      conditions.push('appointment.startTime >= :startDate AND appointment.startTime <= :endDate');
      params.startDate = start.toISOString();
      params.endDate = end.toISOString();
    } else if (date) {
      const dateObj = new Date(date + 'T00:00:00');
      const startOfDay = new Date(dateObj);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateObj);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push('appointment.startTime >= :startOfDay AND appointment.startTime <= :endOfDay');
      params.startOfDay = startOfDay.toISOString();
      params.endOfDay = endOfDay.toISOString();
    }

    if (conditions.length > 0) {
      query.where(conditions.join(' AND '), params);
    }

    query.orderBy('appointment.startTime', 'ASC');

    const total = await query.getCount();
    const data = await query.skip((p - 1) * l).take(l).getMany();

    return {
      data,
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l),
    };
  }

  async findById(id: string, userId?: string): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: ['master', 'service', 'client', 'extraServices'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (userId && appointment.clientId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return appointment;
  }

  async update(
    id: string,
    dto: UpdateAppointmentDto,
    userId?: string,
  ): Promise<Appointment> {
    const appointment = await this.findById(id, userId);

    // Сохраняем исходный статус перед обновлением
    const originalStatus = appointment.status;

    if (dto.startTime) {
      const service = await this.serviceRepository.findOne({
        where: { id: appointment.serviceId },
      });
      const startTime = new Date(dto.startTime);
      if (!service) {
        throw new BadRequestException('Service not found');
      }
      const endTime = new Date(startTime.getTime() + (service.duration || 60) * 60000);

      await this.validateTimeSlot(appointment.masterId, startTime, endTime, id);

      appointment.startTime = startTime;
      appointment.endTime = endTime;
      
      // Сохраняем статус, если запись была подтверждена или ожидает подтверждения
      // Меняем на RESCHEDULED только если статус был COMPLETED или CANCELLED
      if (originalStatus === AppointmentStatus.CONFIRMED || originalStatus === AppointmentStatus.PENDING) {
        // Сохраняем исходный статус
        appointment.status = originalStatus;
      } else {
        appointment.status = AppointmentStatus.RESCHEDULED;
      }
    }

    if (dto.status) {
      appointment.status = dto.status;
    }

    if (dto.notes !== undefined) {
      appointment.notes = dto.notes;
    }

    // Сохраняем старое время для уведомления
    const oldStartTime = dto.startTime ? new Date(appointment.startTime) : undefined;
    
    const updated = await this.appointmentRepository.save(appointment);

    // Уведомления
    if (dto.status === AppointmentStatus.CANCELLED) {
      await this.notificationsService.sendAppointmentCancellation(updated);
      // Уведомление админам об отмене
      try {
        await this.telegramBotService.notifyAdminsAboutCancelledAppointment(
          updated,
          updated.cancellationReason,
        );
      } catch (error: unknown) {
        this.logger.error(`Ошибка при отправке уведомления админам об отмене: ${getErrorMessage(error)}`, getErrorStack(error));
      }
    } else if (dto.startTime) {
      await this.notificationsService.sendAppointmentRescheduled(updated);
      // Уведомление администратору об изменении времени записи
      try {
        await this.telegramBotService.notifyAdminAboutAppointmentUpdate(
          updated,
          oldStartTime,
          originalStatus,
        );
      } catch (error: unknown) {
        this.logger.error(`Ошибка при отправке уведомления администратору об изменении записи: ${getErrorMessage(error)}`, getErrorStack(error));
      }
    } else if (dto.status && dto.status !== originalStatus) {
      // Уведомление администратору об изменении статуса (если время не менялось)
      try {
        await this.telegramBotService.notifyAdminAboutAppointmentUpdate(
          updated,
          undefined,
          originalStatus,
        );
      } catch (error: unknown) {
        this.logger.error(`Ошибка при отправке уведомления администратору об изменении статуса: ${getErrorMessage(error)}`, getErrorStack(error));
      }
    }

    return updated;
  }

  async cancel(id: string, userId: string, reason?: string): Promise<Appointment> {
    const appointment = await this.findById(id, userId);

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Appointment already cancelled');
    }

    // Нельзя отменить завершенную запись
    if (appointment.status === AppointmentStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed appointment');
    }

    appointment.status = AppointmentStatus.CANCELLED;
    appointment.cancellationReason = reason ?? '';

    const cancelled = await this.appointmentRepository.save(appointment);

    // Возврат бонусов и отправка уведомления
    if (appointment.bonusPointsUsed > 0) {
      await this.financialService.refundBonusPoints(
        userId,
        appointment.bonusPointsUsed,
        appointment.id,
      );
    }

    await this.notificationsService.sendAppointmentCancellation(cancelled);

    // Уведомление админам об отмене
    try {
      await this.telegramBotService.notifyAdminsAboutCancelledAppointment(
        cancelled,
        reason,
      );
    } catch (error: unknown) {
      this.logger.error(`Ошибка при отправке уведомления админам об отмене: ${getErrorMessage(error)}`, getErrorStack(error));
    }

    return cancelled;
  }

  async reschedule(
    id: string,
    newStartTime: Date,
    userId: string,
    reason?: string,
  ): Promise<Appointment> {
    const appointment = await this.findById(id, userId);

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Cannot reschedule cancelled appointment');
    }

    if (appointment.status === AppointmentStatus.COMPLETED) {
      throw new BadRequestException('Cannot reschedule completed appointment');
    }

    const service = await this.serviceRepository.findOne({
      where: { id: appointment.serviceId },
    });
    if (!service) {
      throw new BadRequestException('Service not found');
    }
    const endTime = new Date(newStartTime.getTime() + service.duration * 60000);

    // Проверка доступности нового времени
    await this.validateTimeSlot(appointment.masterId, newStartTime, endTime, id);

    // Обновление записи
    appointment.startTime = newStartTime;
    appointment.endTime = endTime;
    appointment.status = AppointmentStatus.RESCHEDULED;
    if (reason) {
      appointment.notes = `${appointment.notes || ''}\nПеренос: ${reason}`.trim();
    }

    const rescheduled = await this.appointmentRepository.save(appointment);

    // Отправка уведомления
    await this.notificationsService.sendAppointmentRescheduled(rescheduled);

    // Уведомление администратору о переносе записи
    try {
      await this.telegramBotService.notifyAdminAboutAppointmentUpdate(
        rescheduled,
        new Date(appointment.startTime),
        appointment.status,
      );
    } catch (error: unknown) {
      this.logger.error(`Ошибка при отправке уведомления администратору о переносе записи: ${getErrorMessage(error)}`, getErrorStack(error));
    }

    return rescheduled;
  }

  async getAvailableSlots(
    masterId: string,
    serviceId: string,
    date: Date,
  ): Promise<Date[]> {
    const master = await this.masterRepository.findOne({
      where: { id: masterId },
      relations: ['services'],
    });
    if (!master) {
      throw new NotFoundException('Master not found');
    }

    const service = await this.serviceRepository.findOne({
      where: { id: serviceId },
    });
    if (!service) {
      throw new NotFoundException('Service not found');
    }

    // Получение расписания мастера
    const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay();
    const schedule = await this.workScheduleRepository.findOne({
      where: { masterId, dayOfWeek: dayOfWeek as DayOfWeek, isActive: true },
    });

    if (!schedule) {
      return [];
    }

    // Получение заблокированных интервалов
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const blocks = await this.blockIntervalRepository.find({
      where: {
        masterId,
        startTime: MoreThanOrEqual(startOfDay),
      },
    });

    // Получение существующих записей
    const appointments = await this.appointmentRepository.find({
      where: {
        masterId,
        startTime: Between(startOfDay, endOfDay),
        status: AppointmentStatus.CONFIRMED,
      },
    });

    // Получаем часовой пояс из настроек
    const timezone = await this.settingsService.get('timezone', 'Europe/Moscow');
    
    // Получаем текущее время в указанном часовом поясе
    // Используем правильный способ получения времени в часовом поясе
    const now = new Date();
    const nowInTimezoneStr = now.toLocaleString('en-US', { timeZone: timezone });
    const nowInTimezone = new Date(nowInTimezoneStr);
    
    // Получаем текущее время в UTC и конвертируем в локальное время часового пояса
    const currentHour = nowInTimezone.getHours();
    const currentMinute = nowInTimezone.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    // Проверяем, является ли запрашиваемая дата сегодняшней
    const today = new Date(nowInTimezone);
    today.setHours(0, 0, 0, 0);
    const requestedDate = new Date(date);
    requestedDate.setHours(0, 0, 0, 0);
    
    // Сравниваем даты в том же часовом поясе
    const todayStr = today.toLocaleDateString('en-US', { timeZone: timezone });
    const requestedDateStr = requestedDate.toLocaleDateString('en-US', { timeZone: timezone });
    const isToday = todayStr === requestedDateStr;

    // Генерация доступных слотов
    // ВАЖНО: Время из расписания (startTime/endTime) интерпретируется как время в таймзоне из настроек
    // Например, '09:00' означает 09:00 в указанной таймзоне (по умолчанию MSK = UTC+3), а не 09:00 UTC
    // В России нет летнего/зимнего времени, MSK всегда = UTC+3 часа
    const slots: Date[] = [];
    const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
    const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
    
    // Используем время окончания работы из расписания мастера, а не из глобальных настроек
    const workingEndTimeInMinutes = endHour * 60 + endMinute;

    // Получаем дату в формате YYYY-MM-DD в указанной таймзоне (из настроек)
    const dateStr = date.toLocaleDateString('en-CA', { timeZone: timezone }); // 'en-CA' даёт формат YYYY-MM-DD
    
    // Создаём строку в формате ISO для времени в таймзоне
    // ВАЖНО: Время из расписания (например, 09:00) - это время в таймзоне MSK (09:00 MSK)
    // MSK = UTC+3, поэтому 09:00 MSK = 06:00 UTC
    // Создаём строку с явным указанием UTC (добавляем 'Z')
    const slotStartStr = `${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00Z`;
    const slotEndStr = `${dateStr}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00Z`;
    
    // Создаём Date объекты: строка с 'Z' интерпретируется как UTC
    // Но время из расписания - это время в MSK, поэтому нужно вычесть смещение
    // Например: 09:00 MSK = 09:00 UTC - 3 часа = 06:00 UTC
    const tzOffsetMs = this.getTimezoneOffsetForDate(new Date(slotStartStr), timezone);
    const slotStart = new Date(new Date(slotStartStr).getTime() - tzOffsetMs);
    const slotEnd = new Date(new Date(slotEndStr).getTime() - tzOffsetMs);

    let currentSlot = new Date(slotStart);

    while (currentSlot.getTime() + service.duration * 60000 <= slotEnd.getTime()) {
      const slotEndTime = new Date(currentSlot.getTime() + service.duration * 60000);
      
      // ВАЖНО: currentSlot - это Date объект в UTC, но нам нужно получить время в локальной таймзоне
      // Используем toLocaleTimeString для получения времени в указанной таймзоне
      const slotTimeStr = currentSlot.toLocaleTimeString('en-US', { 
        timeZone: timezone, 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
      const [slotHour, slotMinute] = slotTimeStr.split(':').map(Number);
      const slotTimeInMinutes = slotHour * 60 + slotMinute;

      // Проверяем, не превышает ли время начала слота время окончания работы
      // Если время начала слота >= времени окончания работы, пропускаем его
      if (slotTimeInMinutes >= workingEndTimeInMinutes) {
        currentSlot = new Date(currentSlot.getTime() + (service.duration + master.breakDuration) * 60000);
        continue;
      }

      // Если это сегодня, фильтруем слоты по текущему времени
      // Показываем только слоты, которые начинаются минимум через 1 час от текущего времени
      if (isToday) {
        // Требуем минимум 1 час от текущего времени
        const oneHourFromNow = currentTimeInMinutes + 60;
        
        if (slotTimeInMinutes < oneHourFromNow) {
          // Пропускаем слот, если он начинается менее чем через час
          currentSlot = new Date(currentSlot.getTime() + (service.duration + master.breakDuration) * 60000);
          continue;
        }
      }

      // Проверка на блокировки
      const isBlocked = blocks.some(
        (block) =>
          (currentSlot >= block.startTime && currentSlot < block.endTime) ||
          (slotEndTime > block.startTime && slotEndTime <= block.endTime),
      );

      // Проверка на существующие записи
      const isOccupied = appointments.some(
        (apt) =>
          (currentSlot >= apt.startTime && currentSlot < apt.endTime) ||
          (slotEndTime > apt.startTime && slotEndTime <= apt.endTime),
      );

      if (!isBlocked && !isOccupied) {
        slots.push(new Date(currentSlot));
      }

      // Следующий слот с учетом перерыва
      currentSlot = new Date(currentSlot.getTime() + (service.duration + master.breakDuration) * 60000);
    }

    return slots;
  }

  private async validateTimeSlot(
    masterId: string,
    startTime: Date,
    endTime: Date,
    excludeAppointmentId?: string,
  ): Promise<void> {
    // Получаем часовой пояс из настроек
    const timezone = await this.settingsService.get('timezone', 'Europe/Moscow');
    
    // Проверка расписания
    // Определяем день недели в таймзоне из настроек
    const startTimeInTz = new Date(startTime.toLocaleString('en-US', { timeZone: timezone }));
    const dayOfWeek = startTimeInTz.getDay() === 0 ? 7 : startTimeInTz.getDay();
    
    const schedule = await this.workScheduleRepository.findOne({
      where: { masterId, dayOfWeek: dayOfWeek as DayOfWeek, isActive: true },
    });

    if (!schedule) {
      throw new BadRequestException('Master is not available at this time');
    }

    const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
    const [endHour, endMinute] = schedule.endTime.split(':').map(Number);

    // ВАЖНО: Время из расписания интерпретируется как время в таймзоне из настроек
    // Используем ту же логику, что и в getAvailableSlots
    const dateStr = startTime.toLocaleDateString('en-CA', { timeZone: timezone });
    // Добавляем 'Z' для явного указания UTC, затем вычитаем смещение таймзоны
    const scheduleStartStr = `${dateStr}T${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00Z`;
    const scheduleEndStr = `${dateStr}T${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00Z`;
    
    // Создаём Date объекты в UTC с учётом смещения таймзоны
    // Например: 09:00 MSK = 09:00 UTC - 3 часа = 06:00 UTC
    const tzOffsetMs = this.getTimezoneOffsetForDate(new Date(scheduleStartStr), timezone);
    const scheduleStart = new Date(new Date(scheduleStartStr).getTime() - tzOffsetMs);
    const scheduleEnd = new Date(new Date(scheduleEndStr).getTime() - tzOffsetMs);

    // Логирование для отладки (можно убрать после проверки)
    this.logger.debug(
      `validateTimeSlot: startTime=${startTime.toISOString()}, endTime=${endTime.toISOString()}, ` +
      `scheduleStart=${scheduleStart.toISOString()}, scheduleEnd=${scheduleEnd.toISOString()}, ` +
      `timezone=${timezone}, tzOffsetMs=${tzOffsetMs}`
    );

    if (startTime < scheduleStart || endTime > scheduleEnd) {
      this.logger.warn(
        `Time slot validation failed: startTime=${startTime.toISOString()} < scheduleStart=${scheduleStart.toISOString()} ` +
        `OR endTime=${endTime.toISOString()} > scheduleEnd=${scheduleEnd.toISOString()}`
      );
      throw new BadRequestException('Time slot is outside master working hours');
    }

    // Проверка блокировок
    const blocks = await this.blockIntervalRepository.find({
      where: {
        masterId,
        startTime: MoreThanOrEqual(new Date(startTime.getTime() - 86400000)),
      },
    });

    const isBlocked = blocks.some(
      (block) =>
        (startTime >= block.startTime && startTime < block.endTime) ||
        (endTime > block.startTime && endTime <= block.endTime),
    );

    if (isBlocked) {
      throw new BadRequestException('Time slot is blocked');
    }

    // Проверка существующих записей
    const existing = await this.appointmentRepository.find({
      where: {
        masterId,
        startTime: Between(
          new Date(startTime.getTime() - 86400000),
          new Date(startTime.getTime() + 86400000),
        ),
        status: AppointmentStatus.CONFIRMED,
      },
    });

    const isOccupied = existing
      .filter((apt) => apt.id !== excludeAppointmentId)
      .some(
        (apt) =>
          (startTime >= apt.startTime && startTime < apt.endTime) ||
          (endTime > apt.startTime && endTime <= apt.endTime),
      );

    if (isOccupied) {
      throw new BadRequestException('Time slot is already booked');
    }
  }

  async confirm(id: string): Promise<Appointment> {
    const appointment = await this.findById(id);
    
    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Cannot confirm cancelled appointment');
    }

    if (appointment.status === AppointmentStatus.COMPLETED) {
      throw new BadRequestException('Cannot confirm completed appointment');
    }

    appointment.status = AppointmentStatus.CONFIRMED;
    const confirmed = await this.appointmentRepository.save(appointment);

    // Отправка уведомления о подтверждении
    await this.notificationsService.sendAppointmentConfirmation(confirmed);

    // Уведомление администратору о подтверждении записи
    try {
      await this.telegramBotService.notifyAdminAboutConfirmedAppointment(confirmed);
    } catch (error: unknown) {
      this.logger.error(`Ошибка при отправке уведомления администратору о подтверждении: ${getErrorMessage(error)}`, getErrorStack(error));
    }

    return confirmed;
  }

  async cancelByAdmin(id: string, reason?: string): Promise<Appointment> {
    const appointment = await this.findById(id);

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Appointment already cancelled');
    }

    if (appointment.status === AppointmentStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed appointment');
    }

    appointment.status = AppointmentStatus.CANCELLED;
    appointment.cancellationReason = reason ?? '';

    const cancelled = await this.appointmentRepository.save(appointment);

    // Отправка уведомления об отмене с причиной или без
    await this.notificationsService.sendAppointmentCancellation(cancelled, reason);

    // Возврат бонусов, если использовались
    if (appointment.bonusPointsUsed > 0) {
      await this.financialService.refundBonusPoints(
        appointment.clientId,
        appointment.bonusPointsUsed,
        appointment.id,
      );
    }

    return cancelled;
  }

  async delete(id: string): Promise<void> {
    const appointment = await this.findById(id);
    await this.appointmentRepository.remove(appointment);
  }

  /**
   * Получает смещение таймзоны для указанной даты (в миллисекундах)
   * ВАЖНО: В России нет летнего/зимнего времени, MSK всегда = UTC+3
   * @param date Дата для которой нужно получить смещение (не используется, но оставлен для совместимости)
   * @param timezone Таймзона (например, 'Europe/Moscow')
   * @returns Смещение в миллисекундах (положительное значение означает, что таймзона впереди UTC)
   */
  private getTimezoneOffsetForDate(date: Date, timezone: string): number {
    // В России нет летнего/зимнего времени с 2014 года
    // MSK (Europe/Moscow) всегда = UTC+3 часа = 3 * 60 * 60 * 1000 миллисекунд
    if (timezone === 'Europe/Moscow' || timezone === 'MSK') {
      return 3 * 60 * 60 * 1000; // Фиксированное смещение +3 часа
    }
    
    // Для других таймзон используем динамическое определение (на случай расширения)
    // Но для MSK всегда возвращаем фиксированное значение
    const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
    const tzStr = date.toLocaleString('en-US', { timeZone: timezone, hour12: false });
    
    const utcDate = new Date(utcStr);
    const tzDate = new Date(tzStr);
    
    return tzDate.getTime() - utcDate.getTime();
  }
}

