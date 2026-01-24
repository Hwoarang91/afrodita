import { Injectable, Logger, OnModuleInit, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, In } from 'typeorm';
import { Appointment, AppointmentStatus } from '../entities/appointment.entity';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { FinancialService } from '../modules/financial/financial.service';
import { SettingsService } from '../modules/settings/settings.service';
import { Service } from '../entities/service.entity';
import { Notification, NotificationType, NotificationStatus, NotificationChannel } from '../entities/notification.entity';
import { User, UserRole } from '../entities/user.entity';
import { TelegramUserSession } from '../entities/telegram-user-session.entity';

@Injectable()
export class SchedulerService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulerService.name);
  
  async onModuleInit() {
    this.logger.log('✅ SchedulerService onModuleInit вызван. Cron задачи зарегистрированы.');
    this.logger.log('📅 Напоминания о записях будут проверяться каждые 30 минут.');
  }
  
  async onApplicationBootstrap() {
    this.logger.log('🚀 SchedulerService onApplicationBootstrap вызван. Приложение готово к работе.');
    
    // Проверка регистрации всех cron задач через SchedulerRegistry
    // В onApplicationBootstrap все уже инициализировано, включая cron задачи
    try {
      const cronJobs = this.schedulerRegistry.getCronJobs();
      this.logger.log(`📋 Зарегистрировано cron задач: ${cronJobs.size}`);
      if (cronJobs.size > 0) {
        cronJobs.forEach((value, key) => {
          const status = value.running ? '✅ активна' : '⏸️ неактивна';
          this.logger.log(`  - ${key}: ${status}`);
        });
      } else {
        this.logger.warn('⚠️ Cron задачи не найдены в SchedulerRegistry');
      }
    } catch (error) {
      this.logger.error('Ошибка при проверке регистрации cron задач:', error);
    }
    
    // Принудительно запускаем проверку сразу после инициализации для тестирования
    // Это гарантирует, что cron задачи работают
    setTimeout(() => {
      this.logger.log('🔍 Запуск первой проверки напоминаний после инициализации...');
      this.sendAppointmentReminders().catch(err => {
        this.logger.error('Ошибка при первой проверке напоминаний:', err);
      });
    }, 5000); // Запускаем через 5 секунд после инициализации
  }

  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(TelegramUserSession)
    private telegramSessionRepository: Repository<TelegramUserSession>,
    private notificationsService: NotificationsService,
    private financialService: FinancialService,
    private settingsService: SettingsService,
    private schedulerRegistry: SchedulerRegistry,
  ) {
    this.logger.log('🔧 SchedulerService constructor вызван');
  }

  // Универсальный метод для отправки напоминаний о записях
  // Проверяет все настраиваемые интервалы динамически
  @Cron(CronExpression.EVERY_30_MINUTES, {
    name: 'sendAppointmentReminders',
  })
  async sendAppointmentReminders() {
    const now = new Date();
    this.logger.log(`[CRON] ⏰ Запуск проверки напоминаний о записях. Время: ${now.toISOString()} (${now.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })})`);
    try {
      
      // Получаем все подтвержденные записи, которые начнутся в ближайшие 48 часов
      const maxHoursAhead = 48;
      const maxTimeFromNow = new Date(now.getTime() + maxHoursAhead * 60 * 60 * 1000);
      
      const appointments = await this.appointmentRepository
        .createQueryBuilder('appointment')
        .leftJoinAndSelect('appointment.client', 'client')
        .leftJoinAndSelect('appointment.master', 'master')
        .leftJoinAndSelect('appointment.service', 'service')
        .where('appointment.startTime >= :now', { now })
        .andWhere('appointment.status = :status', { status: AppointmentStatus.CONFIRMED })
        .getMany();

      // Фильтруем записи, которые начинаются не позже maxTimeFromNow
      const filteredAppointments = appointments.filter(apt => {
        const startTime = apt.startTime instanceof Date ? apt.startTime : new Date(apt.startTime);
        return startTime <= maxTimeFromNow;
      });

      this.logger.log(`[CRON] Найдено ${appointments.length} подтверждённых записей, из них ${filteredAppointments.length} в ближайшие 48 часов`);

      let sentCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      // Получаем глобальные настройки интервалов один раз
      const globalIntervalsRaw = await this.settingsService.get('reminderIntervals', [24, 2]);
      const globalIntervals = Array.isArray(globalIntervalsRaw) ? globalIntervalsRaw : [24, 2];

      for (const appointment of filteredAppointments) {
        try {
          // Используем клиента из relations вместо отдельного запроса
          const client = appointment.client;
          if (!client) {
            this.logger.warn(`Клиент не найден для записи ${appointment.id}`);
            skippedCount++;
            continue;
          }

          const notificationSettings = client.notificationSettings || {};
          
          // Проверяем, включены ли напоминания для этого клиента
          if (notificationSettings.remindersEnabled === false) {
            this.logger.log(`[REMINDER] ⏭️ Напоминания отключены для клиента ${client.id} (запись ${appointment.id})`);
            skippedCount++;
            continue;
          }

          // Используем индивидуальные настройки клиента или глобальные
          const reminderIntervals = notificationSettings.reminderIntervals || globalIntervals;
          const intervals = Array.isArray(reminderIntervals) ? reminderIntervals : globalIntervals;
          
          // Убеждаемся, что startTime - это Date объект
          const appointmentStartTime = appointment.startTime instanceof Date 
            ? appointment.startTime 
            : new Date(appointment.startTime);
          
          // Рассчитываем время до записи в часах (в UTC, что правильно)
          const timeUntilAppointment = (appointmentStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
          
          // Логирование для отладки
          this.logger.log(
            `[REMINDER] Проверка записи ${appointment.id}: время до записи = ${timeUntilAppointment.toFixed(2)}ч, ` +
            `startTime = ${appointmentStartTime.toISOString()}, now = ${now.toISOString()}, ` +
            `интервалы = [${intervals.join(', ')}]`
          );
          
          // Проверяем каждый интервал из настроек
          for (const intervalHours of intervals) {
            // Проверяем, попадает ли текущее время в окно для этого интервала
            // Окно: от (intervalHours - 1) до (intervalHours + 0.5) часов до записи
            // Увеличено окно для гарантированного попадания при запуске каждые 30 минут
            // Например, для интервала 24ч: окно от 23ч до 24.5ч до записи
            const windowStart = intervalHours - 1;
            const windowEnd = intervalHours + 0.5;
            
            this.logger.log(
              `[REMINDER] Интервал ${intervalHours}ч: окно [${windowStart}ч, ${windowEnd}ч], ` +
              `время до записи = ${timeUntilAppointment.toFixed(2)}ч`
            );
            
            if (timeUntilAppointment >= windowStart && timeUntilAppointment <= windowEnd) {
              // Проверяем, не было ли уже отправлено напоминание для этого интервала
              const existingReminder = await this.notificationRepository
                .createQueryBuilder('notification')
                .where('notification.userId = :userId', { userId: appointment.clientId })
                .andWhere('notification.type = :type', { type: NotificationType.APPOINTMENT_REMINDER })
                .andWhere('notification.payload->>\'appointmentId\' = :appointmentId', { appointmentId: appointment.id })
                .andWhere('notification.payload->>\'reminderHours\' = :reminderHours', { reminderHours: intervalHours.toString() })
                .andWhere('notification.status = :status', { status: NotificationStatus.SENT })
                .getOne();

              if (!existingReminder) {
                this.logger.log(`[REMINDER] Отправка напоминания для записи ${appointment.id}, интервал: ${intervalHours}ч`);
                await this.notificationsService.sendAppointmentReminder(appointment, intervalHours);
                sentCount++;
                this.logger.log(`[REMINDER] ✅ Напоминание отправлено для записи ${appointment.id}, интервал: ${intervalHours}ч`);
                break; // Отправляем только одно напоминание за раз
              } else {
                this.logger.log(`[REMINDER] ⏭️ Напоминание для записи ${appointment.id}, интервал ${intervalHours}ч уже отправлено ранее`);
              }
            }
          }
        } catch (error: any) {
          errorCount++;
          this.logger.error(`Ошибка при обработке записи ${appointment.id}: ${error.message}`, error.stack);
          // Продолжаем обработку остальных записей
        }
      }

      // Всегда логируем результат, даже если все счётчики = 0
      this.logger.log(`[CRON] ✅ Напоминания обработаны: отправлено ${sentCount}, пропущено ${skippedCount}, ошибок ${errorCount}`);
    } catch (error: any) {
      this.logger.error(`Критическая ошибка в sendAppointmentReminders: ${error.message}`, error.stack);
    }
  }

  // Запрос отзыва после завершенной записи
  @Cron(CronExpression.EVERY_6_HOURS)
  async sendFeedbackRequests() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    const appointments = await this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.client', 'client')
      .leftJoinAndSelect('appointment.master', 'master')
      .leftJoinAndSelect('appointment.service', 'service')
      .where('appointment.startTime BETWEEN :yesterday AND :yesterdayEnd', { yesterday, yesterdayEnd })
      .andWhere('appointment.status = :status', { status: AppointmentStatus.COMPLETED })
      .getMany();

    for (const appointment of appointments) {
      // Проверяем, не отправляли ли уже запрос
      // В реальной системе нужно добавить флаг в appointment
      await this.notificationsService.sendFeedbackRequest(appointment);
    }
  }

  // Напоминания о днях рождения
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendBirthdayReminders() {
    const today = new Date();
    const todayMonth = today.getMonth() + 1; // 1-12
    const todayDay = today.getDate();

    // Находим всех клиентов с днем рождения сегодня
    const users = await this.userRepository
      .createQueryBuilder('user')
      .where('EXTRACT(MONTH FROM user.dateOfBirth) = :month', { month: todayMonth })
      .andWhere('EXTRACT(DAY FROM user.dateOfBirth) = :day', { day: todayDay })
      .andWhere('user.dateOfBirth IS NOT NULL')
      .andWhere('user.role = :role', { role: 'client' })
      .getMany();

    for (const user of users) {
      // Проверяем настройки уведомлений
      const notificationSettings = user.notificationSettings || {};
      if (notificationSettings.birthdayRemindersEnabled === false) {
        continue; // Пропускаем, если напоминания о днях рождения отключены
      }

      // Проверяем, не было ли уже отправлено напоминание сегодня
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const existingReminder = await this.notificationRepository.findOne({
        where: {
          userId: user.id,
          type: NotificationType.MARKETING,
          createdAt: Between(todayStart, todayEnd),
        },
      });

      if (!existingReminder && user.telegramId) {
        // Используем sendBroadcast для отправки персонализированного сообщения
        await this.notificationsService.sendBroadcast(
          '🎉 С Днем Рождения!',
          `🎂 Дорогой(ая) ${user.firstName || 'клиент'}! Поздравляем вас с Днем Рождения! 🎉\n\nМы подготовили для вас специальное предложение! Запишитесь сегодня и получите скидку!`,
          NotificationChannel.TELEGRAM,
          { userIds: [user.id] },
        );
      }
    }
  }

  // Автоматическая сегментация клиентов
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async updateClientSegments() {
    const users = await this.userRepository.find({
      where: { role: UserRole.CLIENT },
      relations: ['appointments'],
    });

    for (const user of users) {
      const completedAppointments = user.appointments?.filter(
        (apt) => apt.status === AppointmentStatus.COMPLETED,
      ) || [];
      
      const totalSpent = completedAppointments.reduce((sum, apt) => sum + Number(apt.price), 0);
      const visitCount = completedAppointments.length;
      const lastVisit = completedAppointments.length > 0
        ? new Date(Math.max(...completedAppointments.map(apt => new Date(apt.startTime).getTime())))
        : null;
      
      const daysSinceLastVisit = lastVisit
        ? Math.floor((new Date().getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      let segment = 'новый';
      
      if (visitCount === 0) {
        segment = 'новый';
      } else if (daysSinceLastVisit && daysSinceLastVisit > 90) {
        segment = 'неактивный';
      } else if (visitCount >= 10 && totalSpent >= 10000) {
        segment = 'VIP';
      } else if (visitCount >= 5) {
        segment = 'постоянный';
      }

      if (user.segment !== segment) {
        user.segment = segment;
        await this.userRepository.save(user);
      }
    }
  }

  // Начисление бонусов после завершенной записи
  @Cron(CronExpression.EVERY_HOUR)
  async processBonusPoints() {
    const completedAppointments = await this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.client', 'client')
      .leftJoinAndSelect('appointment.service', 'service')
      .where('appointment.status = :status', { status: AppointmentStatus.COMPLETED })
      .andWhere('appointment.bonusPointsEarned = :bonusPointsEarned', { bonusPointsEarned: 0 })
      .getMany();

    for (const appointment of completedAppointments) {
      const service = await this.serviceRepository.findOne({
        where: { id: appointment.serviceId },
      });

      if (service) {
        const bonusPoints = await this.financialService.calculateBonusPoints(
          service,
          appointment.price,
        );

        if (bonusPoints > 0) {
          await this.financialService.awardBonusPoints(
            appointment.clientId,
            appointment.id,
            bonusPoints,
          );

          appointment.bonusPointsEarned = bonusPoints;
          await this.appointmentRepository.save(appointment);

          await this.notificationsService.sendBonusEarned(
            appointment.clientId,
            bonusPoints,
            appointment.id,
          );
        }
      }
    }
  }

  /**
   * Cleanup job для Telegram сессий
   * 
   * Правила очистки:
   * 1. initializing > 24 часа → invalid
   * 2. invalid/revoked > 30 дней → DELETE
   * 
   * Запускается раз в день в 3:00 UTC
   */
  @Cron('0 3 * * *', {
    name: 'cleanupTelegramSessions',
    timeZone: 'UTC',
  })
  async cleanupTelegramSessions() {
    const now = new Date();
    this.logger.log(`[CRON] 🧹 Запуск очистки Telegram сессий. Время: ${now.toISOString()}`);

    try {
      // 1. initializing > 24 часа → invalid
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const initializingSessions = await this.telegramSessionRepository.find({
        where: {
          status: 'initializing' as any,
          createdAt: LessThan(twentyFourHoursAgo),
        },
      });

      if (initializingSessions.length > 0) {
        const updateResult = await this.telegramSessionRepository.update(
          { id: In(initializingSessions.map(s => s.id)) },
          { status: 'invalid' as any, updatedAt: now },
        );
        this.logger.log(`[CRON] ✅ Переведено ${updateResult.affected || 0} сессий из initializing в invalid (старше 24 часов)`);
      }

      // 2. invalid/revoked > 30 дней → DELETE
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oldSessions = await this.telegramSessionRepository.find({
        where: [
          {
            status: 'invalid' as any,
            updatedAt: LessThan(thirtyDaysAgo),
          },
          {
            status: 'revoked' as any,
            updatedAt: LessThan(thirtyDaysAgo),
          },
        ],
      });

      if (oldSessions.length > 0) {
        const deleteResult = await this.telegramSessionRepository.delete(
          oldSessions.map(s => s.id),
        );
        this.logger.log(`[CRON] ✅ Удалено ${deleteResult.affected || 0} старых сессий (invalid/revoked старше 30 дней)`);
      }

      this.logger.log(`[CRON] ✅ Очистка Telegram сессий завершена`);
    } catch (error) {
      this.logger.error(`[CRON] ❌ Ошибка при очистке Telegram сессий: ${error.message}`, error.stack);
    }
  }
}

