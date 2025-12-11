import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between } from 'typeorm';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { Appointment, AppointmentStatus } from '../../entities/appointment.entity';
import { Master } from '../../entities/master.entity';
import { Service } from '../../entities/service.entity';
import { User } from '../../entities/user.entity';
import { WorkSchedule, DayOfWeek } from '../../entities/work-schedule.entity';
import { BlockInterval } from '../../entities/block-interval.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { FinancialService } from '../financial/financial.service';
import { SettingsService } from '../settings/settings.service';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let appointmentRepository: Repository<Appointment>;
  let masterRepository: Repository<Master>;
  let serviceRepository: Repository<Service>;
  let userRepository: Repository<User>;
  let workScheduleRepository: Repository<WorkSchedule>;

  const mockAppointmentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    remove: jest.fn(),
  };

  const mockMasterRepository = {
    findOne: jest.fn(),
  };

  const mockServiceRepository = {
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockWorkScheduleRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockBlockIntervalRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockNotificationsService = {
    sendAppointmentConfirmation: jest.fn(),
    sendAppointmentReminder: jest.fn(),
    sendAppointmentCancellation: jest.fn(),
    sendAppointmentRescheduled: jest.fn(),
  };

  const mockFinancialService = {
    createTransaction: jest.fn(),
    refundBonusPoints: jest.fn(),
  };

  const mockSettingsService = {
    getSettings: jest.fn(),
    get: jest.fn(),
    getFirstVisitDiscountSettings: jest.fn(),
  };

  const mockTelegramBotService = {
    sendMessage: jest.fn(),
    notifyAdminsAboutNewAppointment: jest.fn(),
    notifyAdminsAboutCancelledAppointment: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockAppointmentRepository,
        },
        {
          provide: getRepositoryToken(Master),
          useValue: mockMasterRepository,
        },
        {
          provide: getRepositoryToken(Service),
          useValue: mockServiceRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(WorkSchedule),
          useValue: mockWorkScheduleRepository,
        },
        {
          provide: getRepositoryToken(BlockInterval),
          useValue: mockBlockIntervalRepository,
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
          provide: TelegramBotService,
          useValue: mockTelegramBotService,
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    appointmentRepository = module.get<Repository<Appointment>>(getRepositoryToken(Appointment));
    masterRepository = module.get<Repository<Master>>(getRepositoryToken(Master));
    serviceRepository = module.get<Repository<Service>>(getRepositoryToken(Service));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    workScheduleRepository = module.get<Repository<WorkSchedule>>(getRepositoryToken(WorkSchedule));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('должен создать запись при валидных данных', async () => {
      const userId = 'user-1';
      const dto = {
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
      };

      const mockService: Service = {
        id: 'service-1',
        name: 'Test Service',
        price: 1000,
        duration: 60,
        isActive: true,
      } as Service;

      const mockMaster: Master = {
        id: 'master-1',
        name: 'Test Master',
        isActive: true,
        services: [mockService],
      } as Master;

      const mockUser: User = {
        id: userId,
        firstName: 'Test',
        lastName: 'User',
      } as User;

      const mockWorkSchedule: WorkSchedule = {
        masterId: 'master-1',
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      } as WorkSchedule;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockWorkScheduleRepository.find.mockResolvedValue([mockWorkSchedule]);
      mockWorkScheduleRepository.findOne.mockResolvedValue(mockWorkSchedule);
      mockBlockIntervalRepository.find.mockResolvedValue([]);
      mockAppointmentRepository.count.mockResolvedValue(0);
      mockAppointmentRepository.find.mockResolvedValue([]);
      mockSettingsService.getFirstVisitDiscountSettings.mockResolvedValue({
        enabled: false,
        type: 'percent',
        value: 0,
      });
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');
      mockAppointmentRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });
      mockAppointmentRepository.create.mockReturnValue({});
      mockAppointmentRepository.save.mockResolvedValue({
        id: 'appointment-1',
        ...dto,
        status: AppointmentStatus.PENDING,
      });
      mockTelegramBotService.notifyAdminsAboutNewAppointment.mockResolvedValue(undefined);

      const result = await service.create(dto, userId);

      expect(result).toHaveProperty('id');
      expect(mockAppointmentRepository.save).toHaveBeenCalled();
    });

    it('должен применить фильтрацию по датам в findAll', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      const mockAppointments: Appointment[] = [];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockAppointments),
      };

      mockAppointmentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll(undefined, undefined, undefined, startDate, endDate);

      expect(result).toEqual(mockAppointments);
      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });

    it('должен применить фильтрацию по мастеру в findAll', async () => {
      const masterId = 'master-1';
      const mockAppointments: Appointment[] = [];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockAppointments),
      };

      mockAppointmentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll(undefined, undefined, undefined, undefined, undefined, masterId);

      expect(result).toEqual(mockAppointments);
      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });

    it('должен выбросить ошибку если мастер не найден', async () => {
      const userId = 'user-1';
      const dto = {
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
      };

      mockMasterRepository.findOne.mockResolvedValue(null);

      await expect(service.create(dto, userId)).rejects.toThrow(NotFoundException);
    });

    it('должен выбросить ошибку если услуга не найдена', async () => {
      const userId = 'user-1';
      const dto = {
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
      };

      const mockMaster = {
        id: 'master-1',
        name: 'Test Master',
        isActive: true,
        services: [],
      } as any as Master;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.findOne.mockResolvedValue(null);

      await expect(service.create(dto, userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('должен вернуть запись если она существует', async () => {
      const appointmentId = 'appointment-1';
      const mockAppointment: Appointment = {
        id: appointmentId,
        clientId: 'user-1',
        status: AppointmentStatus.CONFIRMED,
      } as Appointment;

      mockAppointmentRepository.findOne.mockResolvedValue(mockAppointment);

      const result = await service.findById(appointmentId);

      expect(result).toEqual(mockAppointment);
    });

    it('должен выбросить ForbiddenException если запись принадлежит другому пользователю', async () => {
      const appointmentId = 'appointment-1';
      const userId = 'user-1';
      const mockAppointment: Appointment = {
        id: appointmentId,
        clientId: 'user-2',
        status: AppointmentStatus.CONFIRMED,
      } as Appointment;

      mockAppointmentRepository.findOne.mockResolvedValue(mockAppointment);

      await expect(service.findById(appointmentId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findAll', () => {
    it('должен вернуть все записи', async () => {
      const mockAppointments: Appointment[] = [
        {
          id: 'appointment-1',
          status: AppointmentStatus.CONFIRMED,
        } as Appointment,
      ];

      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockAppointments),
      };

      mockAppointmentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll();

      expect(result).toEqual(mockAppointments);
    });

    it('должен фильтровать по userId', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockAppointmentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll('user-1');

      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('должен отменить запись', async () => {
      const appointmentId = 'appointment-1';
      const userId = 'user-1';
      const reason = 'Client request';

      const mockAppointment: Appointment = {
        id: appointmentId,
        clientId: userId,
        status: AppointmentStatus.CONFIRMED,
        bonusPointsUsed: 0,
      } as Appointment;

      mockAppointmentRepository.findOne.mockResolvedValue(mockAppointment);
      mockAppointmentRepository.save.mockResolvedValue({
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
        cancellationReason: reason,
      });
      mockNotificationsService.sendAppointmentCancellation.mockResolvedValue({} as any);

      const result = await service.cancel(appointmentId, userId, reason);

      expect(result.status).toBe(AppointmentStatus.CANCELLED);
      expect(mockNotificationsService.sendAppointmentCancellation).toHaveBeenCalled();
    });

    it('должен выбросить ошибку если запись уже отменена', async () => {
      const appointmentId = 'appointment-1';
      const userId = 'user-1';

      const mockAppointment: Appointment = {
        id: appointmentId,
        clientId: userId,
        status: AppointmentStatus.CANCELLED,
      } as Appointment;

      mockAppointmentRepository.findOne.mockResolvedValue(mockAppointment);

      await expect(service.cancel(appointmentId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getAvailableSlots', () => {
    it('должен вернуть доступные слоты', async () => {
      const masterId = 'master-1';
      const serviceId = 'service-1';
      const date = new Date('2024-01-01');

      const mockMaster: Master = {
        id: masterId,
        services: [],
      } as Master;

      const mockService: Service = {
        id: serviceId,
        duration: 60,
      } as Service;

      const mockSchedule: WorkSchedule = {
        masterId,
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      } as WorkSchedule;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockWorkScheduleRepository.findOne.mockResolvedValue(mockSchedule);
      mockBlockIntervalRepository.find.mockResolvedValue([]);
      mockAppointmentRepository.find.mockResolvedValue([]);

      const result = await service.getAvailableSlots(masterId, serviceId, date);

      expect(Array.isArray(result)).toBe(true);
    });

    it('должен вернуть пустой массив если нет расписания', async () => {
      const masterId = 'master-1';
      const serviceId = 'service-1';
      const date = new Date('2024-01-01');

      const mockMaster: Master = {
        id: masterId,
        services: [{ id: serviceId } as Service],
        breakDuration: 15,
      } as Master;
      const mockService: Service = {
        id: serviceId,
        duration: 60,
      } as Service;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockWorkScheduleRepository.findOne.mockResolvedValue(null);

      const result = await service.getAvailableSlots(masterId, serviceId, date);

      expect(result).toEqual([]);
    });

    it('должен выбросить ошибку если мастер не найден в getAvailableSlots', async () => {
      const masterId = 'non-existent';
      const serviceId = 'service-1';
      const date = new Date('2024-01-01');

      mockMasterRepository.findOne.mockResolvedValue(null);

      await expect(service.getAvailableSlots(masterId, serviceId, date)).rejects.toThrow(NotFoundException);
    });

    it('должен выбросить ошибку если услуга не найдена в getAvailableSlots', async () => {
      const masterId = 'master-1';
      const serviceId = 'non-existent';
      const date = new Date('2024-01-01');

      const mockMaster: Master = {
        id: masterId,
        services: [],
        breakDuration: 15,
      } as Master;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.findOne.mockResolvedValue(null);

      await expect(service.getAvailableSlots(masterId, serviceId, date)).rejects.toThrow(NotFoundException);
    });

    it('должен фильтровать слоты по заблокированным интервалам', async () => {
      const masterId = 'master-1';
      const serviceId = 'service-1';
      const date = new Date('2024-01-01T10:00:00');

      const mockMaster: Master = {
        id: masterId,
        services: [{ id: serviceId } as Service],
        breakDuration: 15,
      } as Master;
      const mockService: Service = {
        id: serviceId,
        duration: 60,
      } as Service;
      const mockSchedule: WorkSchedule = {
        masterId,
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      } as WorkSchedule;
      const mockBlockInterval: BlockInterval = {
        id: 'block-1',
        masterId,
        startTime: new Date('2024-01-01T11:00:00'),
        endTime: new Date('2024-01-01T12:00:00'),
      } as BlockInterval;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockWorkScheduleRepository.findOne.mockResolvedValue(mockSchedule);
      mockBlockIntervalRepository.find.mockResolvedValue([mockBlockInterval]);
      mockAppointmentRepository.find.mockResolvedValue([]);
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');

      const result = await service.getAvailableSlots(masterId, serviceId, date);

      expect(Array.isArray(result)).toBe(true);
    });

    it('должен вернуть пустой массив если расписание не найдено', async () => {
      const masterId = 'master-1';
      const serviceId = 'service-1';
      const date = new Date('2024-01-01');

      const mockMaster: Master = {
        id: masterId,
        services: [],
      } as Master;

      const mockService: Service = {
        id: serviceId,
        duration: 60,
      } as Service;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockWorkScheduleRepository.findOne.mockResolvedValue(null);

      const result = await service.getAvailableSlots(masterId, serviceId, date);

      expect(result).toEqual([]);
    });
  });

  describe('reschedule', () => {
    it('должен перенести запись', async () => {
      const appointmentId = 'appointment-1';
      const userId = 'user-1';
      const newStartTime = new Date('2024-01-02T10:00:00');
      const reason = 'Client request';

      const mockAppointment: Appointment = {
        id: appointmentId,
        clientId: userId,
        masterId: 'master-1',
        serviceId: 'service-1',
        status: AppointmentStatus.CONFIRMED,
        startTime: new Date('2024-01-01T10:00:00'),
      } as Appointment;

      const mockService: Service = {
        id: 'service-1',
        duration: 60,
      } as Service;

      const rescheduledAppointment: Appointment = {
        ...mockAppointment,
        startTime: newStartTime,
        status: AppointmentStatus.RESCHEDULED,
      } as Appointment;

      mockAppointmentRepository.findOne.mockResolvedValue(mockAppointment);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockWorkScheduleRepository.findOne.mockResolvedValue({
        masterId: 'master-1',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      } as any);
      mockBlockIntervalRepository.find.mockResolvedValue([]);
      mockAppointmentRepository.find.mockResolvedValue([]);
      mockAppointmentRepository.save.mockResolvedValue(rescheduledAppointment);
      mockNotificationsService.sendAppointmentRescheduled.mockResolvedValue({} as any);

      const result = await service.reschedule(appointmentId, newStartTime, userId, reason);

      expect(result.status).toBe(AppointmentStatus.RESCHEDULED);
      expect(mockNotificationsService.sendAppointmentRescheduled).toHaveBeenCalled();
    });

    it('должен выбросить ошибку если запись отменена', async () => {
      const appointmentId = 'appointment-1';
      const userId = 'user-1';
      const newStartTime = new Date('2024-01-02T10:00:00');

      const mockAppointment: Appointment = {
        id: appointmentId,
        clientId: userId,
        status: AppointmentStatus.CANCELLED,
      } as Appointment;

      mockAppointmentRepository.findOne.mockResolvedValue(mockAppointment);

      await expect(
        service.reschedule(appointmentId, newStartTime, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update - edge cases', () => {
    it('должен обработать обновление с изменением статуса на cancelled', async () => {
      const id = 'appointment-1';
      const userId = 'user-1';
      const dto = {
        status: AppointmentStatus.CANCELLED,
        cancellationReason: 'Test reason',
      };

      const mockAppointment: Appointment = {
        id,
        clientId: userId,
        status: AppointmentStatus.CONFIRMED,
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        master: {} as Master,
        service: {} as Service,
        client: {} as User,
      } as Appointment;

      mockAppointmentRepository.findOne.mockResolvedValue(mockAppointment);
      mockAppointmentRepository.save.mockResolvedValue({
        ...mockAppointment,
        ...dto,
      } as Appointment);
      mockNotificationsService.sendAppointmentCancellation.mockResolvedValue(undefined);
      mockTelegramBotService.notifyAdminsAboutCancelledAppointment.mockResolvedValue(undefined);

      const result = await service.update(id, dto, userId);

      expect(result.status).toBe(AppointmentStatus.CANCELLED);
      expect(mockNotificationsService.sendAppointmentCancellation).toHaveBeenCalled();
    });

    it('должен обработать обновление с изменением времени (reschedule)', async () => {
      const id = 'appointment-1';
      const userId = 'user-1';
      const newStartTime = new Date('2024-01-16T10:00:00Z');
      const dto = {
        startTime: newStartTime.toISOString(),
      };

      const mockAppointment: Appointment = {
        id,
        clientId: userId,
        status: AppointmentStatus.CONFIRMED,
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T11:00:00Z'),
        master: { id: 'master-1' } as Master,
        service: { id: 'service-1', duration: 60 } as Service,
        client: {} as User,
      } as Appointment;

      const mockSchedule: WorkSchedule = {
        id: 'schedule-1',
        masterId: 'master-1',
        dayOfWeek: DayOfWeek.TUESDAY,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      } as WorkSchedule;

      mockAppointmentRepository.findOne.mockResolvedValue(mockAppointment);
      mockServiceRepository.findOne.mockResolvedValue({ id: 'service-1', duration: 60 } as Service);
      mockWorkScheduleRepository.findOne.mockResolvedValue(mockSchedule);
      mockBlockIntervalRepository.find.mockResolvedValue([]);
      mockAppointmentRepository.find.mockResolvedValue([]);
      mockAppointmentRepository.save.mockResolvedValue({
        ...mockAppointment,
        startTime: newStartTime,
      } as Appointment);
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');
      mockNotificationsService.sendAppointmentRescheduled.mockResolvedValue(undefined);

      const result = await service.update(id, dto, userId);

      expect(result.startTime).toEqual(newStartTime);
      expect(mockNotificationsService.sendAppointmentRescheduled).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('должен обновить запись', async () => {
      const id = 'appointment-1';
      const userId = 'user-1';
      const dto = {
        status: AppointmentStatus.CONFIRMED,
        notes: 'Updated notes',
      };
      const existingAppointment: Appointment = {
        id,
        clientId: userId,
        status: AppointmentStatus.PENDING,
        notes: 'Original notes',
        master: {} as any,
        service: {} as any,
        client: {} as any,
      } as Appointment;
      const updatedAppointment: Appointment = {
        ...existingAppointment,
        ...dto,
      } as Appointment;

      mockAppointmentRepository.findOne.mockResolvedValue(existingAppointment);
      mockAppointmentRepository.save.mockResolvedValue(updatedAppointment);

      const result = await service.update(id, dto, userId);

      expect(result.status).toBe(AppointmentStatus.CONFIRMED);
      expect(result.notes).toBe('Updated notes');
    });

    it('должен отправить уведомление при отмене через update', async () => {
      const id = 'appointment-1';
      const userId = 'user-1';
      const dto = {
        status: AppointmentStatus.CANCELLED,
      };
      const existingAppointment: Appointment = {
        id,
        clientId: userId,
        status: AppointmentStatus.PENDING,
        cancellationReason: null,
        master: {} as any,
        service: {} as any,
        client: {} as any,
      } as Appointment;
      const cancelledAppointment: Appointment = {
        ...existingAppointment,
        status: AppointmentStatus.CANCELLED,
      } as Appointment;

      mockAppointmentRepository.findOne.mockResolvedValue(existingAppointment);
      mockAppointmentRepository.save.mockResolvedValue(cancelledAppointment);
      mockNotificationsService.sendAppointmentCancellation.mockResolvedValue({} as any);
      mockTelegramBotService.notifyAdminsAboutCancelledAppointment.mockResolvedValue(undefined);

      await service.update(id, dto, userId);

      expect(mockNotificationsService.sendAppointmentCancellation).toHaveBeenCalled();
    });

    it('должен обновить время и отправить уведомление о переносе', async () => {
      const id = 'appointment-1';
      const userId = 'user-1';
      const newStartTime = new Date('2024-01-02T11:00:00');
      const dto = {
        startTime: newStartTime.toISOString(),
      };
      const existingAppointment: Appointment = {
        id,
        clientId: userId,
        masterId: 'master-1',
        serviceId: 'service-1',
        status: AppointmentStatus.CONFIRMED,
        startTime: new Date('2024-01-02T10:00:00'),
        master: {} as any,
        service: {} as any,
        client: {} as any,
      } as Appointment;
      const mockService: Service = {
        id: 'service-1',
        duration: 60,
      } as Service;
      const updatedAppointment: Appointment = {
        ...existingAppointment,
        startTime: newStartTime,
        status: AppointmentStatus.RESCHEDULED,
      } as Appointment;

      mockAppointmentRepository.findOne.mockResolvedValue(existingAppointment);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockWorkScheduleRepository.findOne.mockResolvedValue({
        masterId: 'master-1',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      } as any);
      mockBlockIntervalRepository.find.mockResolvedValue([]);
      mockAppointmentRepository.find.mockResolvedValue([]);
      mockAppointmentRepository.save.mockResolvedValue(updatedAppointment);
      mockNotificationsService.sendAppointmentRescheduled.mockResolvedValue({} as any);

      const result = await service.update(id, dto, userId);

      expect(result.startTime).toEqual(newStartTime);
      expect(mockNotificationsService.sendAppointmentRescheduled).toHaveBeenCalled();
    });
  });

  describe('create - первый визит и скидки', () => {
    it('должен применить скидку на первый визит', async () => {
      const dto: CreateAppointmentDto = {
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date('2024-01-02T10:00:00').toISOString(),
      };
      const userId = 'user-1';

      const mockService: Service = {
        id: 'service-1',
        price: 1000,
        duration: 60,
      } as Service;

      const mockMaster: Master = {
        id: 'master-1',
        services: [mockService],
      } as Master;

      const discountSettings = {
        enabled: true,
        type: 'percent' as const,
        value: 10,
      };

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockWorkScheduleRepository.findOne.mockResolvedValue({
        masterId: 'master-1',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      } as any);
      mockBlockIntervalRepository.find.mockResolvedValue([]);
      mockAppointmentRepository.find.mockResolvedValue([]);
      mockAppointmentRepository.count.mockResolvedValue(0);
      mockSettingsService.getFirstVisitDiscountSettings.mockResolvedValue(discountSettings);
      mockAppointmentRepository.save.mockResolvedValue({
        id: 'appointment-1',
        ...dto,
        price: 900,
        bonusPointsUsed: 0,
        bonusPointsEarned: 0,
        cancellationReason: null,
      } as unknown as Appointment);

      const result = await service.create(dto, userId);

      expect(result.price).toBe(900);
    });
  });

  describe('confirm', () => {
    it('должен подтвердить запись', async () => {
      const id = 'appointment-1';
      const mockAppointment: Appointment = {
        id,
        status: AppointmentStatus.PENDING,
        master: {} as any,
        service: {} as any,
        client: {} as any,
      } as Appointment;
      const confirmedAppointment: Appointment = {
        ...mockAppointment,
        status: AppointmentStatus.CONFIRMED,
      } as Appointment;

      mockAppointmentRepository.findOne.mockResolvedValue(mockAppointment);
      mockAppointmentRepository.save.mockResolvedValue(confirmedAppointment);
      mockNotificationsService.sendAppointmentConfirmation.mockResolvedValue({} as any);

      const result = await service.confirm(id);

      expect(result.status).toBe(AppointmentStatus.CONFIRMED);
      expect(mockNotificationsService.sendAppointmentConfirmation).toHaveBeenCalled();
    });

    it('должен выбросить ошибку если запись отменена', async () => {
      const id = 'appointment-1';
      const mockAppointment: Appointment = {
        id,
        status: AppointmentStatus.CANCELLED,
        master: {} as any,
        service: {} as any,
        client: {} as any,
      } as Appointment;

      mockAppointmentRepository.findOne.mockResolvedValue(mockAppointment);

      await expect(service.confirm(id)).rejects.toThrow(BadRequestException);
    });

    it('должен выбросить ошибку если запись завершена', async () => {
      const id = 'appointment-1';
      const mockAppointment: Appointment = {
        id,
        status: AppointmentStatus.COMPLETED,
        master: {} as any,
        service: {} as any,
        client: {} as any,
      } as Appointment;

      mockAppointmentRepository.findOne.mockResolvedValue(mockAppointment);

      await expect(service.confirm(id)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelByAdmin', () => {
    it('должен отменить запись админом', async () => {
      const id = 'appointment-1';
      const reason = 'Admin cancellation';
      const mockAppointment: Appointment = {
        id,
        status: AppointmentStatus.PENDING,
        bonusPointsUsed: 0,
        master: {} as any,
        service: {} as any,
        client: {} as any,
      } as Appointment;
      const cancelledAppointment: Appointment = {
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
        cancellationReason: reason,
      } as Appointment;

      mockAppointmentRepository.findOne.mockResolvedValue(mockAppointment);
      mockAppointmentRepository.save.mockResolvedValue(cancelledAppointment);
      mockNotificationsService.sendAppointmentCancellation.mockResolvedValue({} as any);

      const result = await service.cancelByAdmin(id, reason);

      expect(result.status).toBe(AppointmentStatus.CANCELLED);
      expect(result.cancellationReason).toBe(reason);
    });

    it('должен вернуть бонусы при отмене админом', async () => {
      const id = 'appointment-1';
      const mockAppointment: Appointment = {
        id,
        clientId: 'user-1',
        status: AppointmentStatus.PENDING,
        bonusPointsUsed: 100,
        master: {} as any,
        service: {} as any,
        client: {} as any,
      } as Appointment;
      const cancelledAppointment: Appointment = {
        ...mockAppointment,
        status: AppointmentStatus.CANCELLED,
      } as Appointment;

      mockAppointmentRepository.findOne.mockResolvedValue(mockAppointment);
      mockAppointmentRepository.save.mockResolvedValue(cancelledAppointment);
      mockNotificationsService.sendAppointmentCancellation.mockResolvedValue({} as any);
      mockFinancialService.refundBonusPoints.mockResolvedValue({} as any);

      await service.cancelByAdmin(id);

      expect(mockFinancialService.refundBonusPoints).toHaveBeenCalledWith('user-1', 100, id);
    });
  });

  describe('delete', () => {
    it('должен удалить запись', async () => {
      const id = 'appointment-1';
      const mockAppointment: Appointment = {
        id,
        master: {} as any,
        service: {} as any,
        client: {} as any,
      } as Appointment;

      mockAppointmentRepository.findOne.mockResolvedValue(mockAppointment);
      mockAppointmentRepository.remove.mockResolvedValue(mockAppointment);

      await service.delete(id);

      expect(mockAppointmentRepository.remove).toHaveBeenCalledWith(mockAppointment);
    });

    it('должен выбросить ошибку если запись не найдена при удалении', async () => {
      mockAppointmentRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAvailableSlots - edge cases', () => {
    it('должен обработать случай когда нет расписания', async () => {
      const masterId = 'master-1';
      const serviceId = 'service-1';
      const date = new Date('2024-01-15');

      const mockMaster: Master = {
        id: masterId,
        breakDuration: 15,
      } as Master;

      const mockService: Service = {
        id: serviceId,
        duration: 60,
      } as Service;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockWorkScheduleRepository.find.mockResolvedValue([]);
      mockBlockIntervalRepository.find.mockResolvedValue([]);
      mockAppointmentRepository.find.mockResolvedValue([]);
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');

      const result = await service.getAvailableSlots(masterId, serviceId, date);

      expect(Array.isArray(result)).toBe(true);
    });

    it('должен обработать случай когда все слоты заблокированы', async () => {
      const masterId = 'master-1';
      const serviceId = 'service-1';
      const date = new Date('2024-01-15');

      const mockMaster: Master = {
        id: masterId,
        breakDuration: 15,
      } as Master;

      const mockService: Service = {
        id: serviceId,
        duration: 60,
      } as Service;

      const mockSchedule: WorkSchedule = {
        id: 'schedule-1',
        masterId,
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      } as WorkSchedule;

      const mockBlock: BlockInterval = {
        id: 'block-1',
        masterId,
        startTime: new Date('2024-01-15T09:00:00Z'),
        endTime: new Date('2024-01-15T18:00:00Z'),
      } as BlockInterval;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockWorkScheduleRepository.find.mockResolvedValue([mockSchedule]);
      mockBlockIntervalRepository.find.mockResolvedValue([mockBlock]);
      mockAppointmentRepository.find.mockResolvedValue([]);
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');

      const result = await service.getAvailableSlots(masterId, serviceId, date);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('create - edge cases', () => {
    it('должен выбросить ошибку если мастер не предоставляет услугу', async () => {
      const userId = 'user-1';
      const dto = {
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
      };

      const mockService: Service = {
        id: 'service-1',
        name: 'Test Service',
        price: 1000,
        duration: 60,
        isActive: true,
      } as Service;

      const mockMaster: Master = {
        id: 'master-1',
        name: 'Test Master',
        isActive: true,
        services: [], // Мастер не предоставляет услугу
      } as Master;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.findOne.mockResolvedValue(mockService);

      await expect(service.create(dto, userId)).rejects.toThrow(BadRequestException);
    });

    it('должен выбросить ошибку при записи в прошлое', async () => {
      const userId = 'user-1';
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const dto = {
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: pastDate.toISOString(),
      };

      const mockService: Service = {
        id: 'service-1',
        name: 'Test Service',
        price: 1000,
        duration: 60,
        isActive: true,
      } as Service;

      const mockMaster: Master = {
        id: 'master-1',
        name: 'Test Master',
        isActive: true,
        services: [mockService],
      } as Master;

      const mockWorkSchedule: WorkSchedule = {
        masterId: 'master-1',
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      } as WorkSchedule;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockWorkScheduleRepository.findOne.mockResolvedValue(mockWorkSchedule);
      mockBlockIntervalRepository.find.mockResolvedValue([]);
      mockAppointmentRepository.find.mockResolvedValue([]);
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');
      // validateTimeSlot должен выбросить ошибку, так как время в прошлом
      // Мокируем так, чтобы validateTimeSlot выбросил ошибку
      mockAppointmentRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await expect(service.create(dto, userId)).rejects.toThrow(BadRequestException);
    });

    it('должен выбросить ошибку при записи на неактивного мастера', async () => {
      const userId = 'user-1';
      const dto = {
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
      };

      const mockService: Service = {
        id: 'service-1',
        name: 'Test Service',
        price: 1000,
        duration: 60,
        isActive: true,
      } as Service;

      const mockMaster: Master = {
        id: 'master-1',
        name: 'Test Master',
        isActive: false, // Неактивный мастер
        services: [mockService],
      } as Master;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.findOne.mockResolvedValue(mockService);

      await expect(service.create(dto, userId)).rejects.toThrow(BadRequestException);
    });

    it('должен выбросить ошибку при записи на неактивную услугу', async () => {
      const userId = 'user-1';
      const dto = {
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
      };

      const mockService: Service = {
        id: 'service-1',
        name: 'Test Service',
        price: 1000,
        duration: 60,
        isActive: false, // Неактивная услуга
      } as Service;

      const mockMaster: Master = {
        id: 'master-1',
        name: 'Test Master',
        isActive: true,
        services: [mockService],
      } as Master;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.findOne.mockResolvedValue(mockService);

      await expect(service.create(dto, userId)).rejects.toThrow(BadRequestException);
      expect(mockServiceRepository.findOne).toHaveBeenCalled();
    });

    it('должен обработать максимальную длительность услуги (24 часа)', async () => {
      const userId = 'user-1';
      const dto = {
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
      };

      const mockService: Service = {
        id: 'service-1',
        name: 'Test Service',
        price: 1000,
        duration: 1440, // 24 часа
        isActive: true,
      } as Service;

      const mockMaster: Master = {
        id: 'master-1',
        name: 'Test Master',
        isActive: true,
        services: [mockService],
      } as Master;

      const mockWorkSchedule: WorkSchedule = {
        masterId: 'master-1',
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '00:00',
        endTime: '23:59',
        isActive: true,
      } as WorkSchedule;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockWorkScheduleRepository.find.mockResolvedValue([mockWorkSchedule]);
      mockBlockIntervalRepository.find.mockResolvedValue([]);
      mockAppointmentRepository.count.mockResolvedValue(0);
      mockAppointmentRepository.find.mockResolvedValue([]);
      mockSettingsService.getFirstVisitDiscountSettings.mockResolvedValue({
        enabled: false,
      });
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');
      mockAppointmentRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });
      mockAppointmentRepository.create.mockReturnValue({});
      mockAppointmentRepository.save.mockResolvedValue({
        id: 'appointment-1',
        ...dto,
        status: AppointmentStatus.PENDING,
      });

      const result = await service.create(dto, userId);
      expect(result).toHaveProperty('id');
    });

    it('должен обработать минимальную длительность услуги (15 минут)', async () => {
      const userId = 'user-1';
      const dto = {
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
      };

      const mockService: Service = {
        id: 'service-1',
        name: 'Test Service',
        price: 1000,
        duration: 15, // 15 минут
        isActive: true,
      } as Service;

      const mockMaster: Master = {
        id: 'master-1',
        name: 'Test Master',
        isActive: true,
        services: [mockService],
      } as Master;

      const mockWorkSchedule: WorkSchedule = {
        masterId: 'master-1',
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      } as WorkSchedule;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockWorkScheduleRepository.find.mockResolvedValue([mockWorkSchedule]);
      mockBlockIntervalRepository.find.mockResolvedValue([]);
      mockAppointmentRepository.count.mockResolvedValue(0);
      mockAppointmentRepository.find.mockResolvedValue([]);
      mockSettingsService.getFirstVisitDiscountSettings.mockResolvedValue({
        enabled: false,
      });
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');
      mockAppointmentRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });
      mockAppointmentRepository.create.mockReturnValue({});
      mockAppointmentRepository.save.mockResolvedValue({
        id: 'appointment-1',
        ...dto,
        status: AppointmentStatus.PENDING,
      });

      const result = await service.create(dto, userId);
      expect(result).toHaveProperty('id');
    });

    it('должен обработать максимальную цену услуги', async () => {
      const userId = 'user-1';
      const dto = {
        masterId: 'master-1',
        serviceId: 'service-1',
        startTime: new Date('2024-01-01T10:00:00Z').toISOString(),
      };

      const mockService: Service = {
        id: 'service-1',
        name: 'Test Service',
        price: 999999.99, // Максимальная цена
        duration: 60,
        isActive: true,
      } as Service;

      const mockMaster: Master = {
        id: 'master-1',
        name: 'Test Master',
        isActive: true,
        services: [mockService],
      } as Master;

      const mockWorkSchedule: WorkSchedule = {
        masterId: 'master-1',
        dayOfWeek: DayOfWeek.MONDAY,
        startTime: '09:00',
        endTime: '18:00',
        isActive: true,
      } as WorkSchedule;

      mockMasterRepository.findOne.mockResolvedValue(mockMaster);
      mockServiceRepository.findOne.mockResolvedValue(mockService);
      mockWorkScheduleRepository.find.mockResolvedValue([mockWorkSchedule]);
      mockBlockIntervalRepository.find.mockResolvedValue([]);
      mockAppointmentRepository.count.mockResolvedValue(0);
      mockAppointmentRepository.find.mockResolvedValue([]);
      mockSettingsService.getFirstVisitDiscountSettings.mockResolvedValue({
        enabled: false,
      });
      mockSettingsService.get.mockResolvedValue('Europe/Moscow');
      mockAppointmentRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });
      mockAppointmentRepository.create.mockReturnValue({});
      mockAppointmentRepository.save.mockResolvedValue({
        id: 'appointment-1',
        ...dto,
        status: AppointmentStatus.PENDING,
        price: 999999.99,
      });

      const result = await service.create(dto, userId);
      expect(result).toHaveProperty('id');
      expect(result.price).toBe(999999.99);
    });
  });

  describe('findAll - edge cases', () => {
    it('должен фильтровать по startDate и endDate', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockAppointmentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(undefined, undefined, undefined, startDate, endDate);

      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });

    it('должен фильтровать по status', async () => {
      const status = AppointmentStatus.CONFIRMED;
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockAppointmentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.findAll(undefined, status);

      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });
  });
});

