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
import { User } from '../../entities/user.entity';
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
  });
});


