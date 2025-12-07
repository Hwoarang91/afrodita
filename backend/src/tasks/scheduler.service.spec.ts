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
  let appointmentRepository: Repository<Appointment>;
  let notificationsService: NotificationsService;
  let settingsService: SettingsService;

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
    appointmentRepository = module.get<Repository<Appointment>>(
      getRepositoryToken(Appointment),
    );
    notificationsService = module.get<NotificationsService>(NotificationsService);
    settingsService = module.get<SettingsService>(SettingsService);
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
  });
});

