import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../entities/user.entity';
import { Appointment } from '../../entities/appointment.entity';
import { Transaction } from '../../entities/transaction.entity';
import { Notification } from '../../entities/notification.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
  ) {}

  async findAll(role?: UserRole, search?: string, page: number = 1, limit: number = 20): Promise<{ data: User[]; total: number; page: number; limit: number; totalPages: number }> {
    const query = this.userRepository.createQueryBuilder('user');
    if (role) {
      query.where('user.role = :role', { role });
    }
    if (search) {
      query.andWhere(
        '(user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.phone ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }
    query.orderBy('user.createdAt', 'DESC');

    const total = await query.getCount();
    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const data = await query.getMany();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['appointments', 'transactions'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return await this.userRepository.findOne({
      where: { telegramId },
    });
  }

  async findByPhone(phone: string): Promise<User | null> {
    // Нормализуем номер телефона для поиска
    const normalizedPhone = this.normalizePhone(phone);
    return await this.userRepository.findOne({
      where: { phone: normalizedPhone },
    });
  }

  /**
   * Нормализует номер телефона в формат +7XXXXXXXXXX
   */
  normalizePhone(phone: string): string {
    if (!phone) return phone;
    
    // Удаляем все нецифровые символы кроме +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // Если номер начинается с 8, заменяем на +7
    if (cleaned.startsWith('8')) {
      cleaned = '+7' + cleaned.substring(1);
    }
    // Если номер начинается с 7, добавляем +
    else if (cleaned.startsWith('7') && !cleaned.startsWith('+7')) {
      cleaned = '+' + cleaned;
    }
    // Если номер не начинается с +, добавляем +7
    else if (!cleaned.startsWith('+')) {
      cleaned = '+7' + cleaned;
    }
    // Если номер начинается с +, но не с +7, заменяем на +7
    else if (!cleaned.startsWith('+7')) {
      cleaned = '+7' + cleaned.substring(1).replace(/^7/, '');
    }
    
    return cleaned;
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    Object.assign(user, data);
    return await this.userRepository.save(user);
  }

  async updateBonusPoints(id: string, points: number): Promise<User> {
    const user = await this.findById(id);
    user.bonusPoints = Math.max(0, user.bonusPoints + points);
    return await this.userRepository.save(user);
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create({
      ...data,
      role: data.role || UserRole.CLIENT,
    });
    return await this.userRepository.save(user);
  }

  async delete(id: string): Promise<void> {
    const user = await this.findById(id);
    
    // Проверяем наличие связанных записей
    const appointmentsCount = await this.appointmentRepository.count({
      where: { clientId: id },
    });
    
    const transactionsCount = await this.transactionRepository.count({
      where: { userId: id },
    });
    
    const notificationsCount = await this.notificationRepository.count({
      where: { userId: id },
    });

    if (appointmentsCount > 0) {
      throw new BadRequestException(
        `Невозможно удалить клиента: у него есть ${appointmentsCount} записей. Сначала удалите или отмените все записи.`,
      );
    }
    
    if (transactionsCount > 0) {
      throw new BadRequestException(
        `Невозможно удалить клиента: у него есть ${transactionsCount} транзакций.`,
      );
    }

    // Удаляем уведомления (они не критичны)
    if (notificationsCount > 0) {
      await this.notificationRepository.delete({ userId: id });
    }

    try {
      await this.userRepository.remove(user);
    } catch (error: any) {
      // Если ошибка связана с внешними ключами, даем более понятное сообщение
      if (error.code === '23503' || error.message?.includes('foreign key')) {
        throw new BadRequestException(
          'Невозможно удалить клиента: у него есть связанные записи (записи на услуги, транзакции или уведомления).',
        );
      }
      throw error;
    }
  }

  async getInteractionHistory(userId: string): Promise<any[]> {
    // Получаем все записи
    const appointments = await this.appointmentRepository.find({
      where: { clientId: userId },
      relations: ['master', 'service'],
      order: { createdAt: 'DESC' },
    });

    // Получаем все транзакции
    const transactions = await this.transactionRepository.find({
      where: { userId },
      relations: ['appointment'],
      order: { createdAt: 'DESC' },
    });

    // Получаем все уведомления
    const notifications = await this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    // Объединяем все события в единый массив
    const history: any[] = [];

    // Добавляем записи
    appointments.forEach((apt) => {
      // Событие создания записи
      history.push({
        type: 'appointment_created',
        date: apt.createdAt,
        title: 'Создана запись',
        description: `${apt.service?.name || 'Услуга'} у мастера ${apt.master?.name || 'Мастер'}`,
        details: {
          appointmentId: apt.id,
          serviceName: apt.service?.name,
          masterName: apt.master?.name,
          startTime: apt.startTime,
          price: apt.price,
          status: apt.status,
        },
        icon: '📅',
        color: 'blue',
      });

      // Событие изменения статуса (если было обновление)
      if (apt.updatedAt && apt.updatedAt.getTime() !== apt.createdAt.getTime()) {
        let statusTitle = '';
        let statusDescription = '';
        
        if (apt.status === 'confirmed') {
          statusTitle = 'Запись подтверждена';
          statusDescription = `Запись на ${apt.service?.name || 'услугу'} подтверждена`;
        } else if (apt.status === 'cancelled') {
          statusTitle = 'Запись отменена';
          statusDescription = apt.cancellationReason 
            ? `Запись отменена. Причина: ${apt.cancellationReason}`
            : 'Запись отменена';
        } else if (apt.status === 'completed') {
          statusTitle = 'Запись завершена';
          statusDescription = `Запись на ${apt.service?.name || 'услугу'} завершена`;
        }

        if (statusTitle) {
          history.push({
            type: 'appointment_status_changed',
            date: apt.updatedAt,
            title: statusTitle,
            description: statusDescription,
            details: {
              appointmentId: apt.id,
              serviceName: apt.service?.name,
              masterName: apt.master?.name,
              status: apt.status,
              cancellationReason: apt.cancellationReason,
            },
            icon: apt.status === 'cancelled' ? '❌' : apt.status === 'completed' ? '✅' : '✓',
            color: apt.status === 'cancelled' ? 'red' : apt.status === 'completed' ? 'green' : 'blue',
          });
        }
      }
    });

    // Добавляем транзакции
    transactions.forEach((trx) => {
      let title = '';
      let description = '';
      let icon = '💰';
      let color = 'green';

      if (trx.type === 'bonus_earned') {
        title = 'Начислены бонусы';
        description = `Начислено ${trx.amount} бонусных баллов`;
        icon = '➕';
        color = 'green';
      } else if (trx.type === 'bonus_used') {
        title = 'Списаны бонусы';
        description = `Списано ${trx.amount} бонусных баллов`;
        icon = '➖';
        color = 'orange';
      } else if (trx.type === 'refund') {
        title = 'Возврат бонусов';
        description = `Возвращено ${trx.amount} бонусных баллов`;
        icon = '↩️';
        color = 'blue';
      }

      history.push({
        type: 'transaction',
        date: trx.createdAt,
        title,
        description: trx.description || description,
        details: {
          transactionId: trx.id,
          type: trx.type,
          amount: trx.amount,
          appointmentId: trx.appointmentId,
        },
        icon,
        color,
      });
    });

    // Добавляем уведомления
    notifications.forEach((notif) => {
      history.push({
        type: 'notification',
        date: notif.createdAt,
        title: notif.title || 'Уведомление',
        description: notif.message,
        details: {
          notificationId: notif.id,
          channel: notif.channel,
          status: notif.status,
          type: notif.type,
        },
        icon: notif.channel === 'telegram' ? '📱' : notif.channel === 'sms' ? '💬' : '📧',
        color: notif.status === 'sent' ? 'green' : notif.status === 'failed' ? 'red' : 'gray',
      });
    });

    // Сортируем по дате (от новых к старым)
    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return history;
  }
}

