import { Test, TestingModule } from '@nestjs/testing';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditAction } from '../../entities/audit-log.entity';

describe('SettingsController', () => {
  let controller: SettingsController;
  let settingsService: SettingsService;
  let auditService: AuditService;

  const mockSettingsService = {
    get: jest.fn(),
    set: jest.fn(),
    getBookingSettings: jest.fn(),
    setBookingSettings: jest.fn(),
    getFirstVisitDiscountSettings: jest.fn(),
    setFirstVisitDiscountSettings: jest.fn(),
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SettingsController>(SettingsController);
    settingsService = module.get<SettingsService>(SettingsService);
    auditService = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    it('должен вернуть настройки', async () => {
      const bookingSettings = {
        manualConfirmation: false,
        minAdvanceBooking: 2,
        maxAdvanceBooking: 30,
        cancellationDeadline: 24,
      };

      mockSettingsService.getBookingSettings.mockResolvedValue(bookingSettings);

      const result = await controller.getSettings();

      expect(result).toEqual({ bookingSettings });
    });
  });

  describe('updateSettings', () => {
    it('должен обновить настройки', async () => {
      const req = {
        user: { sub: 'admin-1' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const body = {
        bookingSettings: {
          manualConfirmation: true,
          minAdvanceBooking: 1,
        },
      };
      const mockSetting = {
        id: 'setting-1',
        key: 'bookingSettings',
        value: body.bookingSettings,
      };

      mockSettingsService.getBookingSettings.mockResolvedValue({
        manualConfirmation: false,
        minAdvanceBooking: 2,
      });
      mockSettingsService.setBookingSettings.mockResolvedValue(mockSetting as any);
      mockAuditService.log.mockResolvedValue({} as any);

      const result = await controller.updateSettings(req, body);

      expect(result.success).toBe(true);
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });

  describe('getAutoRefreshInterval', () => {
    it('должен вернуть интервал обновления', async () => {
      const interval = 60;
      mockSettingsService.get.mockResolvedValue(interval);

      const result = await controller.getAutoRefreshInterval();

      expect(result).toEqual({ value: interval });
    });
  });

  describe('setAutoRefreshInterval', () => {
    it('должен установить интервал обновления', async () => {
      const req = {
        user: { sub: 'admin-1' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const body = { value: 120 };

      mockSettingsService.set.mockResolvedValue({} as any);
      mockAuditService.log.mockResolvedValue({} as any);

      const result = await controller.setAutoRefreshInterval(req, body);

      expect(result.success).toBe(true);
      expect(result.value).toBe(120);
    });
  });

  describe('getTimezone', () => {
    it('должен вернуть часовой пояс', async () => {
      const timezone = 'Europe/Moscow';
      mockSettingsService.get.mockResolvedValue(timezone);

      const result = await controller.getTimezone();

      expect(result).toEqual({ value: timezone });
    });
  });

  describe('getFirstVisitDiscount', () => {
    it('должен вернуть настройки скидки', async () => {
      const discountSettings = {
        enabled: true,
        type: 'percent' as const,
        value: 10,
      };

      mockSettingsService.getFirstVisitDiscountSettings.mockResolvedValue(discountSettings);

      const result = await controller.getFirstVisitDiscount();

      expect(result).toEqual({ value: discountSettings });
    });
  });
});

