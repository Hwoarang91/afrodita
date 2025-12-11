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

  describe('updateSettings', () => {
    it('должен вернуть success: true если bookingSettings не указан', async () => {
      const req = {
        user: { sub: 'admin-1' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const body = {};

      const result = await controller.updateSettings(req, body);

      expect(result).toEqual({ success: true });
    });
  });

  describe('setTimezone', () => {
    it('должен установить часовой пояс', async () => {
      const req = {
        user: { sub: 'admin-1' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const body = { value: 'Europe/Kiev' };

      mockSettingsService.set.mockResolvedValue({} as any);
      mockAuditService.log.mockResolvedValue({} as any);

      const result = await controller.setTimezone(req, body);

      expect(result.success).toBe(true);
      expect(result.value).toBe('Europe/Kiev');
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });

  describe('getWorkingHours', () => {
    it('должен вернуть рабочие часы', async () => {
      const workingHours = { start: '09:00', end: '21:00' };
      mockSettingsService.get.mockResolvedValue(workingHours);

      const result = await controller.getWorkingHours();

      expect(result).toEqual({ value: workingHours });
    });
  });

  describe('setWorkingHours', () => {
    it('должен установить рабочие часы', async () => {
      const req = {
        user: { sub: 'admin-1' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const body = { value: { start: '08:00', end: '20:00' } };

      mockSettingsService.set.mockResolvedValue({} as any);
      mockAuditService.log.mockResolvedValue({} as any);

      const result = await controller.setWorkingHours(req, body);

      expect(result.success).toBe(true);
      expect(result.value).toEqual({ start: '08:00', end: '20:00' });
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });

  describe('getReminderIntervals', () => {
    it('должен вернуть интервалы напоминаний', async () => {
      const intervals = [24, 2, 1];
      mockSettingsService.get.mockResolvedValue(intervals);

      const result = await controller.getReminderIntervals();

      expect(result).toEqual({ value: intervals });
    });
  });

  describe('setReminderIntervals', () => {
    it('должен установить интервалы напоминаний', async () => {
      const req = {
        user: { sub: 'admin-1' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const body = { value: [24, 12, 2, 1] };

      mockSettingsService.set.mockResolvedValue({} as any);
      mockAuditService.log.mockResolvedValue({} as any);

      const result = await controller.setReminderIntervals(req, body);

      expect(result.success).toBe(true);
      expect(result.value).toEqual([24, 12, 2, 1]);
      expect(mockAuditService.log).toHaveBeenCalled();
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

  describe('setFirstVisitDiscount', () => {
    it('должен установить настройки скидки на первый визит', async () => {
      const req = {
        user: { sub: 'admin-1' },
        ip: '127.0.0.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      };
      const body = {
        value: {
          enabled: true,
          type: 'percent' as const,
          value: 15,
        },
      };
      const mockSetting = {
        id: 'setting-1',
        key: 'firstVisitDiscount',
        value: body.value,
      };

      mockSettingsService.setFirstVisitDiscountSettings.mockResolvedValue(mockSetting as any);
      mockAuditService.log.mockResolvedValue({} as any);

      const result = await controller.setFirstVisitDiscount(req, body);

      expect(result.success).toBe(true);
      expect(result.value).toEqual(body.value);
      expect(mockAuditService.log).toHaveBeenCalled();
    });
  });
});

