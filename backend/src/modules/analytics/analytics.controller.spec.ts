import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let analyticsService: AnalyticsService;

  const mockAnalyticsService = {
    getDashboardStats: jest.fn(),
    getMasterLoad: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    analyticsService = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('должен вернуть статистику для дашборда', async () => {
      const mockStats = {
        totalAppointments: 10,
        totalRevenue: 50000,
      };

      mockAnalyticsService.getDashboardStats.mockResolvedValue(mockStats);

      const result = await controller.getDashboardStats();

      expect(result).toEqual(mockStats);
    });

    it('должен обработать параметры дат', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      const mockStats = {
        totalAppointments: 5,
      };

      mockAnalyticsService.getDashboardStats.mockResolvedValue(mockStats);

      const result = await controller.getDashboardStats(startDate, endDate);

      expect(result).toEqual(mockStats);
      expect(mockAnalyticsService.getDashboardStats).toHaveBeenCalledWith(
        new Date('2024-01-01T00:00:00.000Z'),
        new Date('2024-01-31T23:59:59.999Z'),
      );
    });
  });

  describe('getMasterLoad', () => {
    it('должен вернуть загрузку мастера', async () => {
      const masterId = 'master-1';
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      const mockLoad = {
        masterId,
        totalAppointments: 20,
        totalHours: 40,
      };

      mockAnalyticsService.getMasterLoad.mockResolvedValue(mockLoad);

      const result = await controller.getMasterLoad(masterId, startDate, endDate);

      expect(result).toEqual(mockLoad);
      expect(mockAnalyticsService.getMasterLoad).toHaveBeenCalledWith(
        masterId,
        new Date(startDate),
        new Date(endDate),
      );
    });
  });
});

