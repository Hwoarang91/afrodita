import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AnalyticsService } from './analytics.service';
import { Appointment, AppointmentStatus } from '../../entities/appointment.entity';
import { Transaction, TransactionType } from '../../entities/transaction.entity';
import { Master } from '../../entities/master.entity';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let appointmentRepository: Repository<Appointment>;
  let transactionRepository: Repository<Transaction>;
  let masterRepository: Repository<Master>;

  const mockAppointmentRepository = {
    find: jest.fn(),
  };

  const mockTransactionRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockMasterRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(Appointment),
          useValue: mockAppointmentRepository,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: getRepositoryToken(Master),
          useValue: mockMasterRepository,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    appointmentRepository = module.get<Repository<Appointment>>(
      getRepositoryToken(Appointment),
    );
    transactionRepository = module.get<Repository<Transaction>>(
      getRepositoryToken(Transaction),
    );
    masterRepository = module.get<Repository<Master>>(getRepositoryToken(Master));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('должен вернуть статистику дашборда', async () => {
      const mockAppointments: Appointment[] = [
        {
          id: 'apt-1',
          status: AppointmentStatus.COMPLETED,
          price: 1000,
          startTime: new Date(),
          masterId: 'master-1',
          serviceId: 'service-1',
          service: { name: 'Service 1' } as any,
          master: { name: 'Master 1' } as any,
        } as Appointment,
      ];

      const mockMasters: Master[] = [
        {
          id: 'master-1',
          name: 'Master 1',
          isActive: true,
        } as Master,
      ];

      const mockRevenue = { total: '-1000' };

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(mockRevenue),
      };

      mockAppointmentRepository.find.mockResolvedValue(mockAppointments);
      mockTransactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockMasterRepository.find.mockResolvedValue(mockMasters);

      const result = await service.getDashboardStats();

      expect(result.totalAppointments).toBe(1);
      expect(result.completedAppointments).toBe(1);
      expect(result.revenue).toBe(1000);
    });

    it('должен использовать указанные даты если они предоставлены', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockAppointmentRepository.find.mockResolvedValue([]);
      mockTransactionRepository.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      });
      mockMasterRepository.find.mockResolvedValue([]);

      await service.getDashboardStats(startDate, endDate);

      expect(mockAppointmentRepository.find).toHaveBeenCalledWith({
        where: {
          startTime: Between(startDate, endDate),
        },
        relations: ['service', 'master'],
      });
    });
  });

  describe('getMasterLoad', () => {
    it('должен вернуть нагрузку мастера', async () => {
      const masterId = 'master-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockAppointments: Appointment[] = [
        {
          id: 'apt-1',
          masterId,
          status: AppointmentStatus.COMPLETED,
          startTime: new Date('2024-01-15T10:00:00'),
          endTime: new Date('2024-01-15T11:00:00'),
        } as Appointment,
      ];

      mockAppointmentRepository.find.mockResolvedValue(mockAppointments);

      const result = await service.getMasterLoad(masterId, startDate, endDate);

      expect(result.totalAppointments).toBe(1);
      expect(result.totalMinutes).toBe(60);
    });

    it('должен вернуть 0 если нет записей', async () => {
      const masterId = 'master-1';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockAppointmentRepository.find.mockResolvedValue([]);

      const result = await service.getMasterLoad(masterId, startDate, endDate);

      expect(result.totalAppointments).toBe(0);
      expect(result.totalMinutes).toBe(0);
      expect(result.totalHours).toBe(0);
    });
  });

  describe('getDashboardStats - дополнительные edge cases', () => {
    it('должен обработать случай с пустым массивом услуг', async () => {
      const mockAppointments: Appointment[] = [];
      const mockRevenue = { total: null };
      const mockMasters: Master[] = [];

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(mockRevenue),
      };

      mockAppointmentRepository.find.mockResolvedValue(mockAppointments);
      mockTransactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockMasterRepository.find.mockResolvedValue(mockMasters);

      const result = await service.getDashboardStats();

      expect(result.serviceStats).toEqual([]);
      expect(result.masterStats).toEqual([]);
    });

    it('должен обработать случай с несколькими услугами', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const mockAppointments: Appointment[] = [
        {
          id: 'apt-1',
          serviceId: 'service-1',
          status: AppointmentStatus.COMPLETED,
          price: 1000,
          service: { name: 'Service 1' } as any,
        } as Appointment,
        {
          id: 'apt-2',
          serviceId: 'service-2',
          status: AppointmentStatus.COMPLETED,
          price: 2000,
          service: { name: 'Service 2' } as any,
        } as Appointment,
      ];
      const mockRevenue = { total: '3000' };
      const mockMasters: Master[] = [];

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(mockRevenue),
      };

      mockAppointmentRepository.find.mockResolvedValue(mockAppointments);
      mockTransactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockMasterRepository.find.mockResolvedValue(mockMasters);

      const result = await service.getDashboardStats(startDate, endDate);

      expect(result.serviceStats.length).toBe(2);
      expect(result.serviceStats[0].revenue).toBeGreaterThanOrEqual(result.serviceStats[1].revenue);
    });
  });

  describe('getDashboardStats - edge cases', () => {
    it('должен обработать случай когда revenue.total равен null', async () => {
      const mockAppointments: Appointment[] = [];
      const mockMasters: Master[] = [];

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      };

      mockAppointmentRepository.find.mockResolvedValue(mockAppointments);
      mockTransactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockMasterRepository.find.mockResolvedValue(mockMasters);

      const result = await service.getDashboardStats();

      expect(result.revenue).toBe(0);
    });

    it('должен обработать случай когда appointments пустой массив', async () => {
      const mockAppointments: Appointment[] = [];
      const mockMasters: Master[] = [];

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      };

      mockAppointmentRepository.find.mockResolvedValue(mockAppointments);
      mockTransactionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockMasterRepository.find.mockResolvedValue(mockMasters);

      const result = await service.getDashboardStats();

      expect(result.totalAppointments).toBe(0);
      expect(result.completionRate).toBe(0);
    });
  });
});


