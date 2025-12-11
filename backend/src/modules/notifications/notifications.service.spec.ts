import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import {
  Notification,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
} from '../../entities/notification.entity';
import { Template } from '../../entities/template.entity';
import { User, UserRole } from '../../entities/user.entity';
import { Appointment, AppointmentStatus } from '../../entities/appointment.entity';
import { TelegramService } from '../telegram/telegram.service';
import { SettingsService } from '../settings/settings.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationRepository: Repository<Notification>;
  let templateRepository: Repository<Template>;
  let userRepository: Repository<User>;
  let telegramService: TelegramService;
  let settingsService: SettingsService;

  const mockNotificationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  const mockTemplateRepository = {
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTelegramService = {
    sendMessage: jest.fn(),
    createInlineKeyboard: jest.fn(),
    sendNotification: jest.fn(),
  };

  const mockSettingsService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepository,
        },
        {
          provide: getRepositoryToken(Template),
          useValue: mockTemplateRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: TelegramService,
          useValue: mockTelegramService,
        },
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    notificationRepository = module.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
    templateRepository = module.get<Repository<Template>>(
      getRepositoryToken(Template),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    telegramService = module.get<TelegramService>(TelegramService);
    settingsService = module.get<SettingsService>(SettingsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendAppointmentConfirmation', () => {
    it('должен отправить уведомление с использованием шаблона', async () => {
      const mockAppointment: Appointment = {
        id: 'appointment-1',
        clientId: 'user-1',
        startTime: new Date('2024-01-01T10:00:00'),
        price: 1000,
        master: { name: 'Test Master' } as any,
        service: { name: 'Test Service' } as any,
      } as Appointment;

      const mockUser: User = {
        id: 'user-1',
        telegramId: '123456789',
      } as User;

      const mockTemplate: Template = {
        id: 'template-1',
        type: NotificationType.APPOINTMENT_CONFIRMED,
        channel: NotificationChannel.TELEGRAM,
        subject: 'Запись подтверждена: {{serviceName}}',
        body: 'Ваша запись на {{serviceName}} к {{masterName}} подтверждена',
        isActive: true,
      } as Template;

      const mockNotification: Notification = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.APPOINTMENT_CONFIRMED,
        status: NotificationStatus.SENT,
      } as Notification;

      mockTemplateRepository.findOne.mockResolvedValue(mockTemplate);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockTelegramService.sendMessage.mockResolvedValue(undefined);
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.sendAppointmentConfirmation(mockAppointment);

      expect(result).toEqual(mockNotification);
      expect(mockTemplateRepository.findOne).toHaveBeenCalled();
    });

    it('должен обработать ошибку при отсутствии telegramId', async () => {
      const mockAppointment: Appointment = {
        id: 'appointment-1',
        clientId: 'user-1',
        startTime: new Date('2024-01-01T10:00:00'),
        price: 1000,
        master: { name: 'Test Master' } as any,
        service: { name: 'Test Service' } as any,
      } as Appointment;

      const mockUser: User = {
        id: 'user-1',
        telegramId: null,
      } as User;

      const mockNotification: Notification = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.APPOINTMENT_CONFIRMED,
        status: NotificationStatus.FAILED,
        error: 'Telegram ID не найден для пользователя',
      } as Notification;

      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save
        .mockResolvedValueOnce({ ...mockNotification, status: NotificationStatus.PENDING } as Notification)
        .mockResolvedValueOnce(mockNotification);

      const result = await service.sendAppointmentConfirmation(mockAppointment);

      expect(result.status).toBe(NotificationStatus.FAILED);
      expect(result.error).toBe('Telegram ID не найден для пользователя');
    });

    it('должен отправить уведомление о подтверждении записи', async () => {
      const mockAppointment: Appointment = {
        id: 'appointment-1',
        clientId: 'user-1',
        startTime: new Date('2024-01-01T10:00:00'),
        price: 1000,
        master: { name: 'Test Master' } as any,
        service: { name: 'Test Service' } as any,
      } as Appointment;

      const mockUser: User = {
        id: 'user-1',
        telegramId: '123456789',
      } as User;

      const mockNotification: Notification = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.APPOINTMENT_CONFIRMED,
        status: NotificationStatus.SENT,
      } as Notification;

      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockTelegramService.sendMessage.mockResolvedValue(undefined);
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.sendAppointmentConfirmation(mockAppointment);

      expect(result).toEqual(mockNotification);
    });

    it('должен обработать ошибку при отправке через Telegram', async () => {
      const mockAppointment: Appointment = {
        id: 'appointment-1',
        clientId: 'user-1',
        startTime: new Date('2024-01-01T10:00:00'),
        price: 1000,
        master: { name: 'Test Master' } as any,
        service: { name: 'Test Service' } as any,
      } as Appointment;

      const mockUser: User = {
        id: 'user-1',
        telegramId: '123456789',
      } as User;

      const mockNotification: Notification = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.APPOINTMENT_CONFIRMED,
        status: NotificationStatus.FAILED,
        error: 'Telegram error',
      } as Notification;

      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockTelegramService.sendMessage.mockRejectedValue(new Error('Telegram error'));
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save
        .mockResolvedValueOnce({ ...mockNotification, status: NotificationStatus.PENDING } as Notification)
        .mockResolvedValueOnce(mockNotification);

      const result = await service.sendAppointmentConfirmation(mockAppointment);

      expect(result.status).toBe(NotificationStatus.FAILED);
      expect(result.error).toBe('Telegram error');
    });
  });

  describe('sendAppointmentReminder', () => {
    it('должен отправить напоминание о записи', async () => {
      const mockAppointment: Appointment = {
        id: 'appointment-1',
        clientId: 'user-1',
        startTime: new Date('2024-01-01T10:00:00'),
        master: { name: 'Test Master' } as any,
        service: { name: 'Test Service' } as any,
      } as Appointment;

      const mockUser: User = {
        id: 'user-1',
        telegramId: '123456789',
      } as User;

      const mockNotification: Notification = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.APPOINTMENT_REMINDER,
        status: NotificationStatus.SENT,
      } as Notification;

      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockTelegramService.sendMessage.mockResolvedValue(undefined);
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.sendAppointmentReminder(mockAppointment, 24);

      expect(result).toEqual(mockNotification);
    });

    it('должен отправить напоминание с reminderHours = 1', async () => {
      const mockAppointment: Appointment = {
        id: 'appointment-1',
        clientId: 'user-1',
        startTime: new Date('2024-01-01T10:00:00'),
        master: { name: 'Test Master' } as any,
        service: { name: 'Test Service' } as any,
      } as Appointment;

      const mockUser: User = {
        id: 'user-1',
        telegramId: '123456789',
      } as User;

      const mockNotification: Notification = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.APPOINTMENT_REMINDER,
        status: NotificationStatus.SENT,
      } as Notification;

      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockTelegramService.sendMessage.mockResolvedValue(undefined);
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.sendAppointmentReminder(mockAppointment, 1);

      expect(result).toEqual(mockNotification);
    });

    it('должен отправить напоминание с reminderHours = 2', async () => {
      const mockAppointment: Appointment = {
        id: 'appointment-1',
        clientId: 'user-1',
        startTime: new Date('2024-01-01T10:00:00'),
        master: { name: 'Test Master' } as any,
        service: { name: 'Test Service' } as any,
      } as Appointment;

      const mockUser: User = {
        id: 'user-1',
        telegramId: '123456789',
      } as User;

      const mockNotification: Notification = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.APPOINTMENT_REMINDER,
        status: NotificationStatus.SENT,
      } as Notification;

      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockTelegramService.sendMessage.mockResolvedValue(undefined);
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.sendAppointmentReminder(mockAppointment, 2);

      expect(result).toEqual(mockNotification);
    });

    it('должен отправить напоминание с reminderHours = 48', async () => {
      const mockAppointment: Appointment = {
        id: 'appointment-1',
        clientId: 'user-1',
        startTime: new Date('2024-01-01T10:00:00'),
        master: { name: 'Test Master' } as any,
        service: { name: 'Test Service' } as any,
      } as Appointment;

      const mockUser: User = {
        id: 'user-1',
        telegramId: '123456789',
      } as User;

      const mockNotification: Notification = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.APPOINTMENT_REMINDER,
        status: NotificationStatus.SENT,
      } as Notification;

      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockTelegramService.sendMessage.mockResolvedValue(undefined);
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.sendAppointmentReminder(mockAppointment, 48);

      expect(result).toEqual(mockNotification);
    });

    it('должен отправить напоминание с reminderHours = 3 (else ветка)', async () => {
      const mockAppointment: Appointment = {
        id: 'appointment-1',
        clientId: 'user-1',
        startTime: new Date('2024-01-01T10:00:00'),
        master: { name: 'Test Master' } as any,
        service: { name: 'Test Service' } as any,
      } as Appointment;

      const mockUser: User = {
        id: 'user-1',
        telegramId: '123456789',
      } as User;

      const mockNotification: Notification = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.APPOINTMENT_REMINDER,
        status: NotificationStatus.SENT,
      } as Notification;

      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockTelegramService.sendMessage.mockResolvedValue(undefined);
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.sendAppointmentReminder(mockAppointment, 3);

      expect(result).toEqual(mockNotification);
    });
  });

  describe('sendBonusEarned', () => {
    it('должен отправить уведомление о начислении бонусов', async () => {
      const userId = 'user-1';
      const points = 100;
      const appointmentId = 'appointment-1';

      const mockUser: User = {
        id: userId,
        telegramId: '123456789',
      } as User;

      const mockNotification: Notification = {
        id: 'notification-1',
        userId,
        type: NotificationType.BONUS_EARNED,
        status: NotificationStatus.SENT,
      } as Notification;

      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockTelegramService.sendMessage.mockResolvedValue(undefined);
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.sendBonusEarned(userId, points, appointmentId);

      expect(result).toEqual(mockNotification);
    });
  });

  describe('sendAppointmentCancellation', () => {
    it('должен отправить уведомление об отмене записи', async () => {
      const mockAppointment: Appointment = {
        id: 'appointment-1',
        clientId: 'user-1',
        startTime: new Date('2024-01-01T10:00:00'),
        master: { name: 'Test Master' } as any,
        service: { name: 'Test Service' } as any,
        cancellationReason: 'Test reason',
      } as Appointment;

      const mockUser: User = {
        id: 'user-1',
        telegramId: '123456789',
      } as User;

      const mockNotification: Notification = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.APPOINTMENT_CANCELLED,
        status: NotificationStatus.SENT,
      } as Notification;

      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockTelegramService.sendMessage.mockResolvedValue(undefined);
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.sendAppointmentCancellation(mockAppointment);

      expect(result).toEqual(mockNotification);
    });

    it('должен отправить уведомление об отмене с указанной причиной', async () => {
      const mockAppointment: Appointment = {
        id: 'appointment-1',
        clientId: 'user-1',
        startTime: new Date('2024-01-01T10:00:00'),
        master: { name: 'Test Master' } as any,
        service: { name: 'Test Service' } as any,
      } as Appointment;

      const mockUser: User = {
        id: 'user-1',
        telegramId: '123456789',
      } as User;

      const mockNotification: Notification = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.APPOINTMENT_CANCELLED,
        status: NotificationStatus.SENT,
      } as Notification;

      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockTelegramService.sendMessage.mockResolvedValue(undefined);
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.sendAppointmentCancellation(mockAppointment, 'Custom reason');

      expect(result).toEqual(mockNotification);
    });
  });

  describe('sendAppointmentRescheduled', () => {
    it('должен отправить уведомление о переносе записи', async () => {
      const mockAppointment: Appointment = {
        id: 'appointment-1',
        clientId: 'user-1',
        startTime: new Date('2024-01-01T10:00:00'),
        master: { name: 'Test Master' } as any,
        service: { name: 'Test Service' } as any,
      } as Appointment;

      const mockUser: User = {
        id: 'user-1',
        telegramId: '123456789',
      } as User;

      const mockNotification: Notification = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.APPOINTMENT_RESCHEDULED,
        status: NotificationStatus.SENT,
      } as Notification;

      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockTelegramService.sendMessage.mockResolvedValue(undefined);
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.sendAppointmentRescheduled(mockAppointment);

      expect(result).toEqual(mockNotification);
    });
  });

  describe('sendFeedbackRequest', () => {
    it('должен отправить запрос на отзыв', async () => {
      const mockAppointment: Appointment = {
        id: 'appointment-1',
        clientId: 'user-1',
        master: { name: 'Test Master' } as any,
        service: { name: 'Test Service' } as any,
      } as Appointment;

      const mockUser: User = {
        id: 'user-1',
        telegramId: '123456789',
      } as User;

      const mockNotification: Notification = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.FEEDBACK_REQUEST,
        status: NotificationStatus.SENT,
      } as Notification;

      mockTelegramService.createInlineKeyboard.mockReturnValue({
        reply_markup: { inline_keyboard: [] },
      });
      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockTelegramService.sendMessage.mockResolvedValue(undefined);
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      const result = await service.sendFeedbackRequest(mockAppointment);

      expect(result).toEqual(mockNotification);
      expect(mockTelegramService.createInlineKeyboard).toHaveBeenCalled();
    });
  });

  describe('sendBroadcast', () => {
    it('должен отправить массовую рассылку', async () => {
      const title = 'Test Title';
      const message = 'Test Message';
      const channel = NotificationChannel.TELEGRAM;
      const mockUsers: User[] = [
        {
          id: 'user-1',
          telegramId: '123456789',
        } as User,
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockUsers),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');
      mockTelegramService.sendMessage.mockResolvedValue(undefined);
      mockNotificationRepository.create.mockReturnValue({});
      mockNotificationRepository.save.mockResolvedValue({
        id: 'notification-1',
        status: NotificationStatus.SENT,
      } as any);

      const result = await service.sendBroadcast(title, message, channel);

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('sent');
      expect(result).toHaveProperty('failed');
    });

    it('должен отправить рассылку конкретным пользователям', async () => {
      const title = 'Test Title';
      const message = 'Test Message';
      const channel = NotificationChannel.TELEGRAM;
      const filters = {
        userIds: ['user-1', 'user-2'],
      };
      const mockUsers: User[] = [
        {
          id: 'user-1',
          telegramId: '123456789',
        } as User,
      ];

      mockUserRepository.find.mockResolvedValue(mockUsers);
      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');
      mockTelegramService.sendMessage.mockResolvedValue(undefined);
      mockNotificationRepository.create.mockReturnValue({});
      mockNotificationRepository.save.mockResolvedValue({
        id: 'notification-1',
        status: NotificationStatus.SENT,
      } as any);

      const result = await service.sendBroadcast(title, message, channel, filters);

      expect(result).toHaveProperty('total');
      expect(mockUserRepository.find).toHaveBeenCalled();
    });

    it('должен отправить рассылку с фильтром по роли', async () => {
      const title = 'Test Title';
      const message = 'Test Message';
      const channel = NotificationChannel.TELEGRAM;
      const filters = {
        role: UserRole.CLIENT,
      };
      const mockUsers: User[] = [
        {
          id: 'user-1',
          telegramId: '123456789',
          role: UserRole.CLIENT,
        } as User,
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockUsers),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');
      mockTelegramService.sendMessage.mockResolvedValue(undefined);
      mockNotificationRepository.create.mockReturnValue({});
      mockNotificationRepository.save.mockResolvedValue({
        id: 'notification-1',
        status: NotificationStatus.SENT,
      } as any);

      const result = await service.sendBroadcast(title, message, channel, filters);

      expect(result).toHaveProperty('total');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('должен обработать ошибку при отправке рассылки', async () => {
      const title = 'Test Title';
      const message = 'Test Message';
      const channel = NotificationChannel.TELEGRAM;
      const mockUsers: User[] = [
        {
          id: 'user-1',
          telegramId: '123456789',
        } as User,
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockUsers),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');
      mockTelegramService.sendNotification.mockRejectedValue(new Error('Send failed'));
      mockNotificationRepository.create.mockReturnValue({});
      mockNotificationRepository.save
        .mockResolvedValueOnce({ id: 'notification-1', status: NotificationStatus.PENDING } as any)
        .mockResolvedValueOnce({ id: 'notification-1', status: NotificationStatus.FAILED } as any);

      const result = await service.sendBroadcast(title, message, channel);

      expect(result.failed).toBeGreaterThan(0);
    });

    it('должен отправить рассылку через SMS канал', async () => {
      const title = 'Test Title';
      const message = 'Test Message';
      const channel = NotificationChannel.SMS;
      const mockUsers: User[] = [
        {
          id: 'user-1',
          phone: '+79991234567',
        } as User,
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockUsers),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockNotificationRepository.create.mockReturnValue({});
      mockNotificationRepository.save.mockResolvedValue({
        id: 'notification-1',
        status: NotificationStatus.SENT,
      } as any);

      const result = await service.sendBroadcast(title, message, channel);

      expect(result.sent).toBeGreaterThan(0);
    });

    it('должен отправить рассылку через EMAIL канал', async () => {
      const title = 'Test Title';
      const message = 'Test Message';
      const channel = NotificationChannel.EMAIL;
      const mockUsers: User[] = [
        {
          id: 'user-1',
          email: 'test@example.com',
        } as User,
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockUsers),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockNotificationRepository.create.mockReturnValue({});
      mockNotificationRepository.save.mockResolvedValue({
        id: 'notification-1',
        status: NotificationStatus.SENT,
      } as any);

      const result = await service.sendBroadcast(title, message, channel);

      expect(result.sent).toBeGreaterThan(0);
    });

    it('должен обработать случай когда канал недоступен для пользователя', async () => {
      const title = 'Test Title';
      const message = 'Test Message';
      const channel = NotificationChannel.TELEGRAM;
      const mockUsers: User[] = [
        {
          id: 'user-1',
          telegramId: null, // Нет telegramId
        } as User,
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockUsers),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockNotificationRepository.create.mockReturnValue({});
      mockNotificationRepository.save.mockResolvedValue({
        id: 'notification-1',
        status: NotificationStatus.FAILED,
        error: 'Канал недоступен для пользователя',
      } as any);

      const result = await service.sendBroadcast(title, message, channel);

      expect(result.failed).toBeGreaterThan(0);
    });

    it('должен обработать ошибку при создании уведомления', async () => {
      const title = 'Test Title';
      const message = 'Test Message';
      const channel = NotificationChannel.TELEGRAM;
      const mockUsers: User[] = [
        {
          id: 'user-1',
          telegramId: '123456789',
        } as User,
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockUsers),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockTemplateRepository.findOne.mockResolvedValue(null);
      mockNotificationRepository.create.mockImplementation(() => {
        throw new Error('Database error');
      });

      const result = await service.sendBroadcast(title, message, channel);

      expect(result.failed).toBeGreaterThan(0);
    });
  });

  describe('getBroadcastHistory', () => {
    it('должен вернуть историю рассылок', async () => {
      const mockNotifications: Notification[] = [
        {
          id: 'notification-1',
          userId: 'user-1',
          type: NotificationType.MARKETING,
          title: 'Test Title',
          message: 'Test Message',
          channel: NotificationChannel.TELEGRAM,
          status: NotificationStatus.SENT,
          payload: { broadcast: true, broadcastId: 'broadcast-1' },
          createdAt: new Date(),
          updatedAt: new Date(),
          sentAt: new Date(),
          error: null,
          user: { id: 'user-1' } as User,
        } as Notification,
      ];

      mockNotificationRepository.find.mockResolvedValue(mockNotifications);

      const result = await service.getBroadcastHistory(1, 20);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
    });
  });

  describe('getBroadcastDetails', () => {
    it('должен вернуть детали рассылки', async () => {
      const broadcastId = 'broadcast-1';
      const mockNotifications: Notification[] = [
        {
          id: 'notification-1',
          userId: 'user-1',
          type: NotificationType.MARKETING,
          title: 'Test Title',
          message: 'Test Message',
          channel: NotificationChannel.TELEGRAM,
          status: NotificationStatus.SENT,
          payload: { broadcast: true, broadcastId },
          createdAt: new Date(),
          updatedAt: new Date(),
          sentAt: new Date(),
          error: null,
          user: {
            id: 'user-1',
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            phone: '+79991234567',
          } as User,
        } as Notification,
      ];

      mockNotificationRepository.find.mockResolvedValue(mockNotifications);

      const result = await service.getBroadcastDetails(broadcastId);

      expect(result).toHaveProperty('broadcastId', broadcastId);
      expect(result).toHaveProperty('total', 1);
      expect(result).toHaveProperty('recipients');
    });

    it('должен вернуть null если рассылка не найдена', async () => {
      const broadcastId = 'non-existent';

      mockNotificationRepository.find.mockResolvedValue([]);

      const result = await service.getBroadcastDetails(broadcastId);

      expect(result).toBeNull();
    });
  });

  describe('getBroadcastDetailsByKey', () => {
    it('должен вернуть детали рассылки по ключу', async () => {
      const title = 'Test Title';
      const message = 'Test Message';
      const channel = NotificationChannel.TELEGRAM;
      const createdAt = new Date().toISOString();
      const mockNotifications: Notification[] = [
        {
          id: 'notification-1',
          userId: 'user-1',
          type: NotificationType.MARKETING,
          title,
          message,
          channel,
          status: NotificationStatus.SENT,
          payload: { broadcast: true },
          createdAt: new Date(createdAt),
          updatedAt: new Date(createdAt),
          sentAt: new Date(createdAt),
          error: null,
          user: {
            id: 'user-1',
            firstName: 'Test',
            lastName: 'User',
          } as User,
        } as Notification,
      ];

      mockNotificationRepository.find.mockResolvedValue(mockNotifications);

      const result = await service.getBroadcastDetailsByKey(title, message, channel, createdAt);

      expect(result).toHaveProperty('title', title);
      expect(result).toHaveProperty('total', 1);
    });

    it('должен вернуть null если рассылка не найдена', async () => {
      const title = 'Non-existent';
      const message = 'Test Message';
      const channel = NotificationChannel.TELEGRAM;
      const createdAt = new Date().toISOString();

      mockNotificationRepository.find.mockResolvedValue([]);

      const result = await service.getBroadcastDetailsByKey(title, message, channel, createdAt);

      expect(result).toBeNull();
    });
  });

  describe('deleteNotification', () => {
    it('должен удалить уведомление', async () => {
      const id = 'notification-1';

      mockNotificationRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.deleteNotification(id);

      expect(mockNotificationRepository.delete).toHaveBeenCalledWith(id);
    });
  });

  describe('deleteNotifications', () => {
    it('должен удалить несколько уведомлений', async () => {
      const ids = ['notification-1', 'notification-2'];

      mockNotificationRepository.delete.mockResolvedValue({ affected: 2 } as any);

      const result = await service.deleteNotifications(ids);

      expect(result).toBe(2);
      expect(mockNotificationRepository.delete).toHaveBeenCalledWith(ids);
    });
  });
});


