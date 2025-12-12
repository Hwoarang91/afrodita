import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between } from 'typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { Appointment, AppointmentStatus } from '../entities/appointment.entity';
import { Service } from '../entities/service.entity';
import { Notification, NotificationType } from '../entities/notification.entity';
import { User, UserRole } from '../entities/user.entity';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { FinancialService } from '../modules/financial/financial.service';
import { SettingsService } from '../modules/settings/settings.service';

describe('SchedulerService', () => {
  let service: SchedulerService;

  const mockAppointmentRepository = {
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockServiceRepository = {
    findOne: jest.fn(),
  };

  const mockNotificationRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    }),
  };

  const mockUserRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    save: jest.fn(),
  };

  const mockNotificationsService = {
    sendAppointmentReminder: jest.fn(),
    sendFeedbackRequest: jest.fn(),
    sendBroadcast: jest.fn(),
    sendBonusEarned: jest.fn(),
  };

  const mockFinancialService = {
    calculateBonusPoints: jest.fn(),
    awardBonusPoints: jest.fn(),
  };

  const mockSettingsService = {
    get: jest.fn(),
  };

  const mockSchedulerRegistry = {
    getCronJobs: jest.fn().mockReturnValue(new Map()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockAppointmentRepository,
        },
        {
          provide: getRepositoryToken(Service),
          useValue: mockServiceRepository,
        },
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: FinancialService,
          useValue: mockFinancialService,
        },
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
        {
          provide: SchedulerRegistry,
          useValue: mockSchedulerRegistry,
        },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendAppointmentReminders', () => {
    it('должен отправить напоминания для записей в ближайшие 48 часов', async () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const mockAppointment: Appointment = {
        id: 'appointment-1',
        startTime: futureTime,
        status: AppointmentStatus.CONFIRMED,
        client: {
          id: 'user-1',
          notificationSettings: { remindersEnabled: true },
        } as any,
        master: { name: 'Master 1' } as any,
        service: { name: 'Service 1' } as any,
      } as Appointment;

      mockAppointmentRepository.find.mockResolvedValue([mockAppointment]);
      mockSettingsService.get.mockResolvedValue([24, 2]);
      mockNotificationsService.sendAppointmentReminder.mockResolvedValue({} as any);

      await service.sendAppointmentReminders();

      expect(mockAppointmentRepository.find).toHaveBeenCalled();
    });

    it('должен пропустить записи если напоминания отключены', async () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const mockAppointment: Appointment = {
        id: 'appointment-1',
        startTime: futureTime,
        status: AppointmentStatus.CONFIRMED,
        client: {
          id: 'user-1',
          notificationSettings: { remindersEnabled: false },
        } as any,
      } as Appointment;

      mockAppointmentRepository.find.mockResolvedValue([mockAppointment]);
      mockSettingsService.get.mockResolvedValue([24, 2]);

      await service.sendAppointmentReminders();

      expect(mockNotificationsService.sendAppointmentReminder).not.toHaveBeenCalled();
    });
  });

  describe('sendFeedbackRequests', () => {
    it('должен отправить запросы на отзыв для завершенных записей', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const mockAppointment: Appointment = {
        id: 'appointment-1',
        startTime: yesterday,
        status: AppointmentStatus.COMPLETED,
        client: {} as any,
        master: {} as any,
        service: {} as any,
      } as Appointment;

      mockAppointmentRepository.find.mockResolvedValue([mockAppointment]);
      mockNotificationsService.sendFeedbackRequest.mockResolvedValue({} as any);

      await service.sendFeedbackRequests();

      expect(mockNotificationsService.sendFeedbackRequest).toHaveBeenCalledWith(
        mockAppointment,
      );
    });
  });

  describe('processBonusPoints', () => {
    it('должен начислить бонусные баллы для завершенных записей', async () => {
      const mockAppointment: Appointment = {
        id: 'appointment-1',
        status: AppointmentStatus.COMPLETED,
        bonusPointsEarned: 0,
        price: 1000,
        clientId: 'user-1',
        serviceId: 'service-1',
        client: {} as any,
        service: {
          id: 'service-1',
          bonusPointsPercent: 10,
        } as any,
      } as Appointment;

      const mockService: Service = {
        id: 'service-1',
        bonusPointsPercent: 10,
      } as Service;

      mockAppointmentRepository.find.mockResolvedValue([mockAppointment]);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockFinancialService.calculateBonusPoints.mockResolvedValue(100);
      mockFinancialService.awardBonusPoints.mockResolvedValue({} as any);
      mockAppointmentRepository.save.mockResolvedValue(mockAppointment);
      mockNotificationsService.sendBonusEarned.mockResolvedValue({} as any);

      await service.processBonusPoints();

      expect(mockFinancialService.calculateBonusPoints).toHaveBeenCalled();
      expect(mockFinancialService.awardBonusPoints).toHaveBeenCalled();
    });

    it('должен пропустить запись если service не найден', async () => {
      const mockAppointment: Appointment = {
        id: 'appointment-1',
        status: AppointmentStatus.COMPLETED,
        bonusPointsEarned: 0,
        price: 1000,
        clientId: 'user-1',
        serviceId: 'service-1',
        client: {} as any,
        service: {} as any,
      } as Appointment;

      mockAppointmentRepository.find.mockResolvedValue([mockAppointment]);
      mockServiceRepository.findOne.mockResolvedValue(null);

      await service.processBonusPoints();

      expect(mockFinancialService.calculateBonusPoints).not.toHaveBeenCalled();
    });

    it('должен пропустить запись если bonusPoints = 0', async () => {
      const mockAppointment: Appointment = {
        id: 'appointment-1',
        status: AppointmentStatus.COMPLETED,
        bonusPointsEarned: 0,
        price: 1000,
        clientId: 'user-1',
        serviceId: 'service-1',
        client: {} as any,
        service: {
          id: 'service-1',
          bonusPointsPercent: 10,
        } as any,
      } as Appointment;

      const mockService: Service = {
        id: 'service-1',
        bonusPointsPercent: 10,
      } as Service;

      mockAppointmentRepository.find.mockResolvedValue([mockAppointment]);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockFinancialService.calculateBonusPoints.mockResolvedValue(0);

      await service.processBonusPoints();

      expect(mockFinancialService.awardBonusPoints).not.toHaveBeenCalled();
      expect(mockNotificationsService.sendBonusEarned).not.toHaveBeenCalled();
    });
  });

  describe('onModuleInit', () => {
    it('должен логировать инициализацию', async () => {
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      await service.onModuleInit();
      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe('onApplicationBootstrap', () => {
    it('должен логировать bootstrap и проверять cron задачи', async () => {
      const mockCronJobs = new Map();
      mockCronJobs.set('test-job', { running: true });
      mockSchedulerRegistry.getCronJobs.mockReturnValue(mockCronJobs);

      const loggerSpy = jest.spyOn(service['logger'], 'log');
      await service.onApplicationBootstrap();

      expect(loggerSpy).toHaveBeenCalled();
      expect(mockSchedulerRegistry.getCronJobs).toHaveBeenCalled();
    });

    it('должен обработать ошибку при проверке cron задач', async () => {
      mockSchedulerRegistry.getCronJobs.mockImplementation(() => {
        throw new Error('Test error');
      });

      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');
      await service.onApplicationBootstrap();

      expect(loggerErrorSpy).toHaveBeenCalled();
    });
  });

  describe('sendAppointmentReminders', () => {
    it('должен пропустить записи без клиента', async () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const mockAppointment = {
        id: 'appointment-1',
        startTime: futureTime,
        status: AppointmentStatus.CONFIRMED,
        clientId: 'user-1',
        masterId: 'master-1',
        serviceId: 'service-1',
        endTime: futureTime,
        price: 1000,
        bonusPointsUsed: 0,
        bonusPointsEarned: 0,
        notes: null,
        cancellationReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        client: null,
        master: null,
        service: null,
      } as unknown as Appointment;

      mockAppointmentRepository.find.mockResolvedValue([mockAppointment]);
      mockSettingsService.get.mockResolvedValue([24, 2]);

      await service.sendAppointmentReminders();

      expect(mockNotificationsService.sendAppointmentReminder).not.toHaveBeenCalled();
    });

    it('должен использовать индивидуальные настройки интервалов клиента', async () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 12 * 60 * 60 * 1000);

      const mockAppointment: Appointment = {
        id: 'appointment-1',
        startTime: futureTime,
        status: AppointmentStatus.CONFIRMED,
        clientId: 'user-1',
        client: {
          id: 'user-1',
          notificationSettings: {
            remindersEnabled: true,
            reminderIntervals: [12, 6],
          },
        } as any,
        master: { name: 'Master 1' } as any,
        service: { name: 'Service 1' } as any,
      } as Appointment;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      mockAppointmentRepository.find.mockResolvedValue([mockAppointment]);
      mockSettingsService.get.mockResolvedValue([24, 2]);
      mockNotificationRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockNotificationsService.sendAppointmentReminder.mockResolvedValue({} as any);

      await service.sendAppointmentReminders();

      expect(mockNotificationsService.sendAppointmentReminder).toHaveBeenCalled();
    });

    it('должен пропустить напоминание если оно уже было отправлено', async () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const mockAppointment: Appointment = {
        id: 'appointment-1',
        startTime: futureTime,
        status: AppointmentStatus.CONFIRMED,
        clientId: 'user-1',
        client: {
          id: 'user-1',
          notificationSettings: { remindersEnabled: true },
        } as any,
        master: { name: 'Master 1' } as any,
        service: { name: 'Service 1' } as any,
      } as Appointment;

      const mockExistingReminder = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.APPOINTMENT_REMINDER,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockExistingReminder),
      };

      mockAppointmentRepository.find.mockResolvedValue([mockAppointment]);
      mockSettingsService.get.mockResolvedValue([24, 2]);
      mockNotificationRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.sendAppointmentReminders();

      expect(mockNotificationsService.sendAppointmentReminder).not.toHaveBeenCalled();
    });

    it('должен обработать ошибку при обработке записи', async () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const mockAppointment: Appointment = {
        id: 'appointment-1',
        startTime: futureTime,
        status: AppointmentStatus.CONFIRMED,
        client: {
          id: 'user-1',
          notificationSettings: { remindersEnabled: true },
        } as any,
        master: { name: 'Master 1' } as any,
        service: { name: 'Service 1' } as any,
      } as Appointment;

      mockAppointmentRepository.find.mockResolvedValue([mockAppointment]);
      mockSettingsService.get.mockResolvedValue([24, 2]);
      mockNotificationRepository.createQueryBuilder.mockImplementation(() => {
        throw new Error('Test error');
      });

      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');
      await service.sendAppointmentReminders();

      expect(loggerErrorSpy).toHaveBeenCalled();
    });
  });

  describe('sendBirthdayReminders', () => {
    it('должен отправить напоминания о днях рождения', async () => {
      const today = new Date();
      const mockUser = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        username: null,
        phone: null,
        email: null,
        password: null,
        dateOfBirth: new Date(today.getFullYear() - 30, today.getMonth(), today.getDate()),
        role: UserRole.CLIENT,
        bonusPoints: 0,
        isActive: true,
        preferences: null,
        adminNotes: null,
        weight: null,
        photoUrl: null,
        tags: null,
        segment: null,
        telegramId: '123456789',
        notificationSettings: { birthdayRemindersEnabled: true },
        createdAt: new Date(),
        updatedAt: new Date(),
        appointments: [],
        transactions: [],
        notifications: [],
      } as unknown as User;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockUser]),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockNotificationRepository.findOne.mockResolvedValue(null);
      mockNotificationsService.sendBroadcast.mockResolvedValue({} as any);

      await service.sendBirthdayReminders();

      expect(mockNotificationsService.sendBroadcast).toHaveBeenCalled();
    });

    it('должен пропустить пользователей с отключенными напоминаниями о днях рождения', async () => {
      const today = new Date();
      const mockUser = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        username: null,
        phone: null,
        email: null,
        password: null,
        dateOfBirth: new Date(today.getFullYear() - 30, today.getMonth(), today.getDate()),
        role: UserRole.CLIENT,
        bonusPoints: 0,
        isActive: true,
        preferences: null,
        adminNotes: null,
        weight: null,
        photoUrl: null,
        tags: null,
        segment: null,
        telegramId: null,
        notificationSettings: { birthdayRemindersEnabled: false },
        createdAt: new Date(),
        updatedAt: new Date(),
        appointments: [],
        transactions: [],
        notifications: [],
      } as unknown as User;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockUser]),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.sendBirthdayReminders();

      expect(mockNotificationsService.sendBroadcast).not.toHaveBeenCalled();
    });

    it('должен пропустить пользователей без telegramId', async () => {
      const today = new Date();
      const mockUser = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        username: null,
        phone: null,
        email: null,
        password: null,
        dateOfBirth: new Date(today.getFullYear() - 30, today.getMonth(), today.getDate()),
        role: UserRole.CLIENT,
        bonusPoints: 0,
        isActive: true,
        preferences: null,
        adminNotes: null,
        weight: null,
        photoUrl: null,
        tags: null,
        segment: null,
        telegramId: null,
        notificationSettings: { birthdayRemindersEnabled: true },
        createdAt: new Date(),
        updatedAt: new Date(),
        appointments: [],
        transactions: [],
        notifications: [],
      } as unknown as User;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockUser]),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockNotificationRepository.findOne.mockResolvedValue(null);

      await service.sendBirthdayReminders();

      expect(mockNotificationsService.sendBroadcast).not.toHaveBeenCalled();
    });

    it('должен пропустить если напоминание уже было отправлено сегодня', async () => {
      const today = new Date();
      const mockUser = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        username: null,
        phone: null,
        email: null,
        password: null,
        dateOfBirth: new Date(today.getFullYear() - 30, today.getMonth(), today.getDate()),
        role: UserRole.CLIENT,
        bonusPoints: 0,
        isActive: true,
        preferences: null,
        adminNotes: null,
        weight: null,
        photoUrl: null,
        tags: null,
        segment: null,
        telegramId: '123456789',
        notificationSettings: { birthdayRemindersEnabled: true },
        createdAt: new Date(),
        updatedAt: new Date(),
        appointments: [],
        transactions: [],
        notifications: [],
      } as unknown as User;

      const mockExistingReminder = {
        id: 'notification-1',
        userId: 'user-1',
        type: NotificationType.MARKETING,
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockUser]),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockNotificationRepository.findOne.mockResolvedValue(mockExistingReminder);

      await service.sendBirthdayReminders();

      expect(mockNotificationsService.sendBroadcast).not.toHaveBeenCalled();
    });
  });

  describe('updateClientSegments', () => {
    it('должен установить сегмент "новый" для клиента без записей', async () => {
      const mockUser = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        username: null,
        phone: null,
        email: null,
        password: null,
        role: UserRole.CLIENT,
        bonusPoints: 0,
        isActive: true,
        preferences: null,
        adminNotes: null,
        dateOfBirth: null,
        weight: null,
        photoUrl: null,
        tags: null,
        segment: null,
        telegramId: null,
        notificationSettings: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        appointments: [],
        transactions: [],
        notifications: [],
      } as unknown as User;

      mockUserRepository.find.mockResolvedValue([mockUser]);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, segment: 'новый' } as User);

      await service.updateClientSegments();

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ segment: 'новый' }),
      );
    });

    it('должен установить сегмент "неактивный" для клиента без визитов более 90 дней', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      const mockUser = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        username: null,
        phone: null,
        email: null,
        password: null,
        role: UserRole.CLIENT,
        bonusPoints: 0,
        isActive: true,
        preferences: null,
        adminNotes: null,
        dateOfBirth: null,
        weight: null,
        photoUrl: null,
        tags: null,
        segment: 'постоянный',
        telegramId: null,
        notificationSettings: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        appointments: [
          {
            id: 'appointment-1',
            status: AppointmentStatus.COMPLETED,
            startTime: oldDate,
            price: 1000,
          } as Appointment,
        ],
        transactions: [],
        notifications: [],
      } as unknown as User;

      mockUserRepository.find.mockResolvedValue([mockUser]);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, segment: 'неактивный' } as User);

      await service.updateClientSegments();

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ segment: 'неактивный' }),
      );
    });

    it('должен установить сегмент "VIP" для клиента с 10+ визитами и 10000+ потрачено', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);
      const mockAppointments = Array.from({ length: 10 }, (_, i) => ({
        id: `appointment-${i}`,
        status: AppointmentStatus.COMPLETED,
        startTime: recentDate,
        price: 1500,
      })) as Appointment[];

      const mockUser = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        username: null,
        phone: null,
        email: null,
        password: null,
        role: UserRole.CLIENT,
        bonusPoints: 0,
        isActive: true,
        preferences: null,
        adminNotes: null,
        dateOfBirth: null,
        weight: null,
        photoUrl: null,
        tags: null,
        segment: 'постоянный',
        telegramId: null,
        notificationSettings: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        appointments: mockAppointments,
        transactions: [],
        notifications: [],
      } as unknown as User;

      mockUserRepository.find.mockResolvedValue([mockUser]);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, segment: 'VIP' } as User);

      await service.updateClientSegments();

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ segment: 'VIP' }),
      );
    });

    it('должен установить сегмент "постоянный" для клиента с 5+ визитами', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);
      const mockAppointments = Array.from({ length: 5 }, (_, i) => ({
        id: `appointment-${i}`,
        status: AppointmentStatus.COMPLETED,
        startTime: recentDate,
        price: 1000,
      })) as Appointment[];

      const mockUser = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        username: null,
        phone: null,
        email: null,
        password: null,
        role: UserRole.CLIENT,
        bonusPoints: 0,
        isActive: true,
        preferences: null,
        adminNotes: null,
        dateOfBirth: null,
        weight: null,
        photoUrl: null,
        tags: null,
        segment: 'новый',
        telegramId: null,
        notificationSettings: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        appointments: mockAppointments,
        transactions: [],
        notifications: [],
      } as unknown as User;

      mockUserRepository.find.mockResolvedValue([mockUser]);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, segment: 'постоянный' } as User);

      await service.updateClientSegments();

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ segment: 'постоянный' }),
      );
    });

    it('не должен обновлять сегмент если он не изменился', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);
      const mockAppointments = Array.from({ length: 5 }, (_, i) => ({
        id: `appointment-${i}`,
        status: AppointmentStatus.COMPLETED,
        startTime: recentDate,
        price: 1000,
      })) as Appointment[];

      const mockUser = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        username: null,
        phone: null,
        email: null,
        password: null,
        role: UserRole.CLIENT,
        bonusPoints: 0,
        isActive: true,
        preferences: null,
        adminNotes: null,
        dateOfBirth: null,
        weight: null,
        photoUrl: null,
        tags: null,
        segment: 'постоянный',
        telegramId: null,
        notificationSettings: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        appointments: mockAppointments,
        transactions: [],
        notifications: [],
      } as unknown as User;

      mockUserRepository.find.mockResolvedValue([mockUser]);

      await service.updateClientSegments();

      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('должен установить сегмент "новый" для клиента с 1-2 визитами (остается новый)', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);
      const mockAppointments = [
        {
          id: 'appointment-1',
          status: AppointmentStatus.COMPLETED,
          startTime: recentDate,
          price: 1000,
        } as Appointment,
      ];

      const mockUser = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        username: null,
        phone: null,
        email: null,
        password: null,
        role: UserRole.CLIENT,
        bonusPoints: 0,
        isActive: true,
        preferences: null,
        adminNotes: null,
        dateOfBirth: null,
        weight: null,
        photoUrl: null,
        tags: null,
        segment: null,
        telegramId: null,
        notificationSettings: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        appointments: mockAppointments,
        transactions: [],
        notifications: [],
      } as unknown as User;

      mockUserRepository.find.mockResolvedValue([mockUser]);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, segment: 'новый' } as User);

      await service.updateClientSegments();

      // Для 1-2 визитов сегмент остается "новый"
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ segment: 'новый' }),
      );
    });

    it('должен установить сегмент "новый" для клиента с 3-4 визитами (еще не постоянный)', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);
      const mockAppointments = Array.from({ length: 3 }, (_, i) => ({
        id: `appointment-${i}`,
        status: AppointmentStatus.COMPLETED,
        startTime: recentDate,
        price: 1000,
      })) as Appointment[];

      const mockUser = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        username: null,
        phone: null,
        email: null,
        password: null,
        role: UserRole.CLIENT,
        bonusPoints: 0,
        isActive: true,
        preferences: null,
        adminNotes: null,
        dateOfBirth: null,
        weight: null,
        photoUrl: null,
        tags: null,
        segment: null,
        telegramId: null,
        notificationSettings: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        appointments: mockAppointments,
        transactions: [],
        notifications: [],
      } as unknown as User;

      mockUserRepository.find.mockResolvedValue([mockUser]);
      // Для 3 визитов сегмент остается "новый" (нужно 5+ для "постоянный")
      mockUserRepository.save.mockResolvedValue({ ...mockUser, segment: 'новый' } as User);

      await service.updateClientSegments();

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ segment: 'новый' }),
      );
    });

    it('должен обработать клиента без lastVisit', async () => {
      const mockUser = {
        id: 'user-1',
        firstName: 'Test',
        lastName: 'User',
        username: null,
        phone: null,
        email: null,
        password: null,
        role: UserRole.CLIENT,
        bonusPoints: 0,
        isActive: true,
        preferences: null,
        adminNotes: null,
        dateOfBirth: null,
        weight: null,
        photoUrl: null,
        tags: null,
        segment: null,
        telegramId: null,
        notificationSettings: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        appointments: [],
        transactions: [],
        notifications: [],
      } as unknown as User;

      mockUserRepository.find.mockResolvedValue([mockUser]);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, segment: 'новый' } as User);

      await service.updateClientSegments();

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ segment: 'новый' }),
      );
    });
  });

  describe('sendAppointmentReminders - edge cases', () => {
    it('должен обработать критическую ошибку', async () => {
      mockAppointmentRepository.find.mockRejectedValue(new Error('Database error'));

      const loggerErrorSpy = jest.spyOn(service['logger'], 'error');
      await service.sendAppointmentReminders();

      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    it('должен обработать записи вне окна интервала', async () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 50 * 60 * 60 * 1000); // 50 часов вперед

      const mockAppointment: Appointment = {
        id: 'appointment-1',
        startTime: futureTime,
        status: AppointmentStatus.CONFIRMED,
        client: {
          id: 'user-1',
          notificationSettings: { remindersEnabled: true },
        } as any,
        master: { name: 'Master 1' } as any,
        service: { name: 'Service 1' } as any,
      } as Appointment;

      mockAppointmentRepository.find.mockResolvedValue([mockAppointment]);
      mockSettingsService.get.mockResolvedValue([24, 2]);

      await service.sendAppointmentReminders();

      // Запись вне окна 48 часов, должна быть отфильтрована
      expect(mockNotificationsService.sendAppointmentReminder).not.toHaveBeenCalled();
    });

    it('должен обработать запись с startTime как строкой', async () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const mockAppointment: Appointment = {
        id: 'appointment-1',
        startTime: futureTime.toISOString() as any,
        status: AppointmentStatus.CONFIRMED,
        client: {
          id: 'user-1',
          notificationSettings: { remindersEnabled: true },
        } as any,
        master: { name: 'Master 1' } as any,
        service: { name: 'Service 1' } as any,
      } as Appointment;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      mockAppointmentRepository.find.mockResolvedValue([mockAppointment]);
      mockSettingsService.get.mockResolvedValue([24, 2]);
      mockNotificationRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockNotificationsService.sendAppointmentReminder.mockResolvedValue({} as any);

      await service.sendAppointmentReminders();

      expect(mockAppointmentRepository.find).toHaveBeenCalled();
    });
  });
});

