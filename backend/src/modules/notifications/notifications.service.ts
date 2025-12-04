import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType, NotificationChannel, NotificationStatus } from '../../entities/notification.entity';
import { Template } from '../../entities/template.entity';
import { Appointment } from '../../entities/appointment.entity';
import { User, UserRole } from '../../entities/user.entity';
import { TelegramService } from '../telegram/telegram.service';
import { SettingsService } from '../settings/settings.service';
import * as Handlebars from 'handlebars';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(Template)
    private templateRepository: Repository<Template>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private telegramService: TelegramService,
    private settingsService: SettingsService,
  ) {}

  async sendAppointmentConfirmation(appointment: Appointment): Promise<Notification> {
    return await this.sendNotification(
      appointment.clientId,
      NotificationType.APPOINTMENT_CONFIRMED,
      NotificationChannel.TELEGRAM,
      {
        appointmentId: appointment.id,
        masterName: (appointment.master as any)?.name || 'Мастер',
        serviceName: (appointment.service as any)?.name || 'Услуга',
        startTime: appointment.startTime,
        price: appointment.price,
      },
    );
  }

  async sendAppointmentReminder(appointment: Appointment, reminderHours: number = 24): Promise<Notification> {
    return await this.sendNotification(
      appointment.clientId,
      NotificationType.APPOINTMENT_REMINDER,
      NotificationChannel.TELEGRAM,
      {
        appointmentId: appointment.id,
        masterName: (appointment.master as any)?.name || 'Мастер',
        serviceName: (appointment.service as any)?.name || 'Услуга',
        startTime: appointment.startTime,
        reminderHours: reminderHours,
      },
    );
  }

  async sendAppointmentCancellation(appointment: Appointment, reason?: string): Promise<Notification> {
    const cancellationReason = reason || appointment.cancellationReason;
    return await this.sendNotification(
      appointment.clientId,
      NotificationType.APPOINTMENT_CANCELLED,
      NotificationChannel.TELEGRAM,
      {
        appointmentId: appointment.id,
        masterName: (appointment.master as any)?.name || 'Мастер',
        serviceName: (appointment.service as any)?.name || 'Услуга',
        startTime: appointment.startTime,
        reason: cancellationReason,
      },
    );
  }

  async sendAppointmentRescheduled(appointment: Appointment): Promise<Notification> {
    return await this.sendNotification(
      appointment.clientId,
      NotificationType.APPOINTMENT_RESCHEDULED,
      NotificationChannel.TELEGRAM,
      {
        appointmentId: appointment.id,
        masterName: (appointment.master as any)?.name || 'Мастер',
        serviceName: (appointment.service as any)?.name || 'Услуга',
        startTime: appointment.startTime,
      },
    );
  }

  async sendBonusEarned(userId: string, points: number, appointmentId: string): Promise<Notification> {
    return await this.sendNotification(
      userId,
      NotificationType.BONUS_EARNED,
      NotificationChannel.TELEGRAM,
      {
        points,
        appointmentId,
      },
    );
  }

  async sendFeedbackRequest(appointment: Appointment): Promise<Notification> {
    // Создаем кнопку для отзыва
    const keyboard = this.telegramService.createInlineKeyboard([
      [
        {
          text: '💬 Оставить отзыв',
          callback_data: `review:${appointment.id}`,
        },
      ],
    ]);

    return await this.sendNotification(
      appointment.clientId,
      NotificationType.FEEDBACK_REQUEST,
      NotificationChannel.TELEGRAM,
      {
        appointmentId: appointment.id,
        masterName: (appointment.master as any)?.name || 'Мастер',
        serviceName: (appointment.service as any)?.name || 'Услуга',
      },
      { replyMarkup: keyboard.reply_markup },
    );
  }

  private async sendNotification(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
    data: Record<string, any>,
    options?: { replyMarkup?: any },
  ): Promise<Notification> {
    // Получение шаблона
    const template = await this.templateRepository.findOne({
      where: { type, channel, isActive: true },
    });

    let title = 'Уведомление';
    let message = '';

    if (template) {
      const titleTemplate = Handlebars.compile(template.subject);
      const bodyTemplate = Handlebars.compile(template.body);
      title = titleTemplate(data);
      message = bodyTemplate(data);
    } else {
      // Дефолтные шаблоны
      title = this.getDefaultTitle(type);
      message = await this.getDefaultMessage(type, data);
    }

    // Создание записи уведомления
    const notification = this.notificationRepository.create({
      userId,
      type,
      channel,
      title,
      message,
      payload: data,
      status: NotificationStatus.PENDING,
    });

    const saved = await this.notificationRepository.save(notification);

    // Отправка через соответствующий канал
    try {
      if (channel === NotificationChannel.TELEGRAM) {
        // Получаем пользователя для получения telegramId
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (user && user.telegramId) {
          await this.telegramService.sendMessage(user.telegramId, message, {
            parse_mode: 'Markdown',
            reply_markup: options?.replyMarkup,
          });
        } else {
          throw new Error('Telegram ID не найден для пользователя');
        }
      } else if (channel === NotificationChannel.SMS) {
        // Заглушка для SMS
        this.logger.debug(`[SMS] ${userId}: ${message}`);
      } else if (channel === NotificationChannel.EMAIL) {
        // Заглушка для Email
        this.logger.debug(`[EMAIL] ${userId}: ${message}`);
      }

      saved.status = NotificationStatus.SENT;
      saved.sentAt = new Date();
    } catch (error) {
      saved.status = NotificationStatus.FAILED;
      saved.error = error.message;
    }

    return await this.notificationRepository.save(saved);
  }

  private getDefaultTitle(type: NotificationType): string {
    const titles = {
      [NotificationType.APPOINTMENT_CONFIRMED]: '✅ Запись подтверждена',
      [NotificationType.APPOINTMENT_REMINDER]: '⏰ Напоминание о записи',
      [NotificationType.APPOINTMENT_CANCELLED]: '❌ Запись отменена',
      [NotificationType.APPOINTMENT_RESCHEDULED]: '🔄 Запись перенесена',
      [NotificationType.BONUS_EARNED]: '🎁 Бонусы начислены',
      [NotificationType.FEEDBACK_REQUEST]: '💬 Оставьте отзыв',
      [NotificationType.MARKETING]: '📢 Специальное предложение',
    };
    return titles[type] || 'Уведомление';
  }

  private async getDefaultMessage(type: NotificationType, data: Record<string, any>): Promise<string> {
    if (type === NotificationType.APPOINTMENT_REMINDER) {
      const reminderHours = data.reminderHours || 24;
      const startTime = new Date(data.startTime);
      
      // Получаем таймзону из настроек для правильного отображения времени
      const timezone = await this.settingsService.get('timezone', 'Europe/Moscow');
      
      const timeStr = startTime.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: timezone, // Используем таймзону из настроек
      });
      const dateStr = startTime.toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'long',
        timeZone: timezone, // Используем таймзону из настроек
      });
      
      // Формируем сообщение в зависимости от интервала
      let timePhrase = '';
      if (reminderHours === 1) {
        timePhrase = 'через 1 час';
      } else if (reminderHours === 2) {
        timePhrase = 'через 2 часа';
      } else if (reminderHours === 6) {
        timePhrase = 'через 6 часов';
      } else if (reminderHours === 12) {
        timePhrase = 'через 12 часов';
      } else if (reminderHours === 24) {
        timePhrase = 'завтра';
      } else if (reminderHours === 48) {
        timePhrase = 'послезавтра';
      } else {
        timePhrase = `через ${reminderHours} ${reminderHours === 1 ? 'час' : reminderHours < 5 ? 'часа' : 'часов'}`;
      }
      
      return `⏰ Напоминание: у вас запись на ${data.serviceName} к ${data.masterName} ${timePhrase} (${dateStr} в ${timeStr}). Пожалуйста, приходите вовремя!`;
    }

    const messages = {
      [NotificationType.APPOINTMENT_CONFIRMED]: `Ваша запись на ${data.serviceName} к ${data.masterName} подтверждена на ${new Date(data.startTime).toLocaleString('ru-RU')}. Стоимость: ${data.price} руб.`,
      [NotificationType.APPOINTMENT_CANCELLED]: data.reason 
        ? `Ваша запись была отменена.\nПричина: ${data.reason}`
        : `Ваша запись была отменена.`,
      [NotificationType.APPOINTMENT_RESCHEDULED]: `Ваша запись на ${data.serviceName} перенесена на ${new Date(data.startTime).toLocaleString('ru-RU')}.`,
      [NotificationType.BONUS_EARNED]: `Вам начислено ${data.points} бонусных баллов!`,
      [NotificationType.FEEDBACK_REQUEST]: `Пожалуйста, оставьте отзыв о посещении ${data.serviceName} у ${data.masterName}.`,
      [NotificationType.MARKETING]: data.message || 'Специальное предложение для вас!',
    };
    return messages[type] || 'Уведомление';
  }

  /**
   * Массовая рассылка сообщений
   */
  async sendBroadcast(
    title: string,
    message: string,
    channel: NotificationChannel,
    filters?: {
      role?: UserRole;
      userIds?: string[];
    },
  ): Promise<{ total: number; sent: number; failed: number }> {
    // Получаем список пользователей для рассылки
    let users: User[];
    
    if (filters?.userIds && filters.userIds.length > 0) {
      // Рассылка конкретным пользователям
      users = await this.userRepository.find({
        where: filters.userIds.map(id => ({ id })),
      });
    } else {
      // Рассылка всем пользователям с фильтром по роли
      const query = this.userRepository.createQueryBuilder('user')
        .where('user.isActive = :isActive', { isActive: true });
      
      // Для Telegram рассылки фильтруем только пользователей с telegramId
      if (channel === NotificationChannel.TELEGRAM) {
        query.andWhere('user.telegramId IS NOT NULL');
      }
      
      if (filters?.role) {
        query.andWhere('user.role = :role', { role: filters.role });
      }
      
      users = await query.getMany();
    }

    // Генерируем уникальный ID для всей рассылки (один для всех получателей)
    const broadcastId = `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const results = {
      total: users.length,
      sent: 0,
      failed: 0,
    };

    // Отправляем сообщения всем пользователям
    for (const user of users) {
      try {
        const notification = this.notificationRepository.create({
          userId: user.id,
          type: NotificationType.MARKETING,
          channel,
          title,
          message,
          status: NotificationStatus.PENDING,
          payload: { broadcast: true, broadcastId },
        });

        const saved = await this.notificationRepository.save(notification);

        // Отправка через соответствующий канал
        try {
          if (channel === NotificationChannel.TELEGRAM && user.telegramId) {
            await this.telegramService.sendNotification(user.telegramId, title, message);
            saved.status = NotificationStatus.SENT;
            saved.sentAt = new Date();
            results.sent++;
          } else if (channel === NotificationChannel.SMS) {
            // Заглушка для SMS
            this.logger.debug(`[SMS Broadcast] ${user.phone}: ${message}`);
            saved.status = NotificationStatus.SENT;
            saved.sentAt = new Date();
            results.sent++;
          } else if (channel === NotificationChannel.EMAIL) {
            // Заглушка для Email
            this.logger.debug(`[EMAIL Broadcast] ${user.email}: ${message}`);
            saved.status = NotificationStatus.SENT;
            saved.sentAt = new Date();
            results.sent++;
          } else {
            saved.status = NotificationStatus.FAILED;
            saved.error = 'Канал недоступен для пользователя';
            results.failed++;
          }
        } catch (error) {
          saved.status = NotificationStatus.FAILED;
          saved.error = error.message;
          results.failed++;
        }

        await this.notificationRepository.save(saved);
      } catch (error) {
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Получение истории рассылок (группированные)
   */
  async getBroadcastHistory(page: number = 1, limit: number = 20) {
    // Получаем все рассылки
    const allNotifications = await this.notificationRepository.find({
      where: {
        type: NotificationType.MARKETING,
        payload: { broadcast: true } as any,
      },
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });

    // Группируем по broadcastId или по title + message + channel + время (округленное до минуты)
    const grouped = new Map<string, {
      broadcastId?: string;
      title: string;
      message: string;
      channel: NotificationChannel;
      createdAt: Date;
      total: number;
      sent: number;
      failed: number;
      pending: number;
      notificationIds: string[];
    }>();

    for (const notification of allNotifications) {
      const payload = notification.payload || {};
      const broadcastId = payload.broadcastId;
      
      // Используем broadcastId если есть, иначе создаем ключ из title + message + channel + округленное время
      const key = broadcastId || `${notification.title}|${notification.message}|${notification.channel}|${Math.floor(notification.createdAt.getTime() / 60000)}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          broadcastId,
          title: notification.title,
          message: notification.message,
          channel: notification.channel,
          createdAt: notification.createdAt,
          total: 0,
          sent: 0,
          failed: 0,
          pending: 0,
          notificationIds: [],
        });
      }

      const group = grouped.get(key)!;
      group.total++;
      group.notificationIds.push(notification.id);
      
      if (notification.status === NotificationStatus.SENT) {
        group.sent++;
      } else if (notification.status === NotificationStatus.FAILED) {
        group.failed++;
      } else {
        group.pending++;
      }
    }

    // Преобразуем в массив и сортируем по дате
    const groupedArray = Array.from(grouped.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );

    // Пагинация
    const total = groupedArray.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = groupedArray.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Получение деталей рассылки
   */
  async getBroadcastDetails(broadcastId: string) {
    // Если broadcastId есть в payload
    const notifications = await this.notificationRepository.find({
      where: {
        type: NotificationType.MARKETING,
        payload: { broadcast: true, broadcastId } as any,
      },
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });

    if (notifications.length > 0) {
      return {
        broadcastId,
        title: notifications[0].title,
        message: notifications[0].message,
        channel: notifications[0].channel,
        createdAt: notifications[0].createdAt,
        total: notifications.length,
        sent: notifications.filter(n => n.status === NotificationStatus.SENT).length,
        failed: notifications.filter(n => n.status === NotificationStatus.FAILED).length,
        pending: notifications.filter(n => n.status === NotificationStatus.PENDING).length,
        recipients: notifications.map(n => ({
          id: n.id,
          userId: n.userId,
          user: n.user ? {
            id: n.user.id,
            firstName: n.user.firstName,
            lastName: n.user.lastName,
            email: n.user.email,
            phone: n.user.phone,
          } : null,
          status: n.status,
          sentAt: n.sentAt,
          error: n.error,
        })),
      };
    }

    // Если broadcastId не найден, пытаемся найти по ключу (title + message + channel + время)
    // Это для старых рассылок без broadcastId
    return null;
  }

  /**
   * Получение деталей рассылки по ключу (для старых рассылок)
   */
  async getBroadcastDetailsByKey(title: string, message: string, channel: NotificationChannel, createdAt: string) {
    const targetTime = new Date(createdAt);
    const timeKey = Math.floor(targetTime.getTime() / 60000);
    
    const allNotifications = await this.notificationRepository.find({
      where: {
        type: NotificationType.MARKETING,
        payload: { broadcast: true } as any,
        title,
        message,
        channel,
      },
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });

    // Фильтруем по времени (в пределах той же минуты)
    const filtered = allNotifications.filter(n => 
      Math.floor(n.createdAt.getTime() / 60000) === timeKey
    );

    if (filtered.length > 0) {
      return {
        title: filtered[0].title,
        message: filtered[0].message,
        channel: filtered[0].channel,
        createdAt: filtered[0].createdAt,
        total: filtered.length,
        sent: filtered.filter(n => n.status === NotificationStatus.SENT).length,
        failed: filtered.filter(n => n.status === NotificationStatus.FAILED).length,
        pending: filtered.filter(n => n.status === NotificationStatus.PENDING).length,
        recipients: filtered.map(n => ({
          id: n.id,
          userId: n.userId,
          user: n.user ? {
            id: n.user.id,
            firstName: n.user.firstName,
            lastName: n.user.lastName,
            email: n.user.email,
            phone: n.user.phone,
          } : null,
          status: n.status,
          sentAt: n.sentAt,
          error: n.error,
        })),
      };
    }

    return null;
  }

  /**
   * Удаление уведомления
   */
  async deleteNotification(id: string): Promise<void> {
    await this.notificationRepository.delete(id);
  }

  /**
   * Массовое удаление уведомлений
   */
  async deleteNotifications(ids: string[]): Promise<number> {
    const result = await this.notificationRepository.delete(ids);
    return result.affected || 0;
  }
}

