import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingsService } from './settings.service';
import { Settings } from '../../entities/settings.entity';

describe('SettingsService', () => {
  let service: SettingsService;
  let settingsRepository: Repository<Settings>;

  const mockSettingsRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: getRepositoryToken(Settings),
          useValue: mockSettingsRepository,
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    settingsRepository = module.get<Repository<Settings>>(
      getRepositoryToken(Settings),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('должен вернуть значение настройки если она существует', async () => {
      const key = 'testKey';
      const value = 'testValue';
      const mockSetting: Settings = {
        id: 'setting-1',
        key,
        value,
      } as Settings;

      mockSettingsRepository.findOne.mockResolvedValue(mockSetting);

      const result = await service.get(key);

      expect(result).toBe(value);
    });

    it('должен вернуть defaultValue если настройка не найдена', async () => {
      const key = 'nonExistentKey';
      const defaultValue = 'default';

      mockSettingsRepository.findOne.mockResolvedValue(null);

      const result = await service.get(key, defaultValue);

      expect(result).toBe(defaultValue);
    });

    it('должен вернуть null если настройка не найдена и defaultValue не указан', async () => {
      const key = 'nonExistentKey';

      mockSettingsRepository.findOne.mockResolvedValue(null);

      const result = await service.get(key);

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('должен обновить существующую настройку', async () => {
      const key = 'testKey';
      const newValue = 'newValue';
      const existingSetting: Settings = {
        id: 'setting-1',
        key,
        value: 'oldValue',
      } as Settings;

      mockSettingsRepository.findOne.mockResolvedValue(existingSetting);
      mockSettingsRepository.save.mockResolvedValue({
        ...existingSetting,
        value: newValue,
      });

      const result = await service.set(key, newValue);

      expect(result.value).toBe(newValue);
      expect(mockSettingsRepository.save).toHaveBeenCalled();
    });

    it('должен создать новую настройку если она не существует', async () => {
      const key = 'newKey';
      const value = 'newValue';
      const newSetting: Settings = {
        id: 'setting-1',
        key,
        value,
      } as Settings;

      mockSettingsRepository.findOne.mockResolvedValue(null);
      mockSettingsRepository.create.mockReturnValue(newSetting);
      mockSettingsRepository.save.mockResolvedValue(newSetting);

      const result = await service.set(key, value);

      expect(result).toEqual(newSetting);
      expect(mockSettingsRepository.create).toHaveBeenCalledWith({ key, value });
    });
  });

  describe('getBookingSettings', () => {
    it('должен вернуть настройки бронирования из БД', async () => {
      const bookingSettings = {
        manualConfirmation: true,
        minAdvanceBooking: 1,
        maxAdvanceBooking: 60,
        cancellationDeadline: 48,
      };

      const mockSetting: Settings = {
        id: 'setting-1',
        key: 'bookingSettings',
        value: bookingSettings,
      } as Settings;

      mockSettingsRepository.findOne.mockResolvedValue(mockSetting);

      const result = await service.getBookingSettings();

      expect(result).toEqual(bookingSettings);
    });

    it('должен вернуть дефолтные настройки если они не найдены в БД', async () => {
      mockSettingsRepository.findOne.mockResolvedValue(null);

      const result = await service.getBookingSettings();

      expect(result).toEqual({
        manualConfirmation: false,
        minAdvanceBooking: 2,
        maxAdvanceBooking: 30,
        cancellationDeadline: 24,
      });
    });
  });

  describe('setBookingSettings', () => {
    it('должен сохранить настройки бронирования', async () => {
      const bookingSettings = {
        manualConfirmation: true,
        minAdvanceBooking: 1,
        maxAdvanceBooking: 60,
        cancellationDeadline: 48,
      };

      const mockSetting: Settings = {
        id: 'setting-1',
        key: 'bookingSettings',
        value: bookingSettings,
      } as Settings;

      mockSettingsRepository.findOne.mockResolvedValue(null);
      mockSettingsRepository.create.mockReturnValue(mockSetting);
      mockSettingsRepository.save.mockResolvedValue(mockSetting);

      const result = await service.setBookingSettings(bookingSettings);

      expect(result.value).toEqual(bookingSettings);
    });
  });

  describe('getFirstVisitDiscountSettings', () => {
    it('должен вернуть настройки скидки для первого визита из БД', async () => {
      const discountSettings = {
        enabled: true,
        type: 'percent' as const,
        value: 10,
      };

      const mockSetting: Settings = {
        id: 'setting-1',
        key: 'firstVisitDiscount',
        value: discountSettings,
      } as Settings;

      mockSettingsRepository.findOne.mockResolvedValue(mockSetting);

      const result = await service.getFirstVisitDiscountSettings();

      expect(result).toEqual(discountSettings);
    });

    it('должен вернуть дефолтные настройки если они не найдены в БД', async () => {
      mockSettingsRepository.findOne.mockResolvedValue(null);

      const result = await service.getFirstVisitDiscountSettings();

      expect(result).toEqual({
        enabled: false,
        type: 'percent',
        value: 0,
      });
    });
  });

  describe('setFirstVisitDiscountSettings', () => {
    it('должен сохранить настройки скидки для первого визита', async () => {
      const discountSettings = {
        enabled: true,
        type: 'fixed' as const,
        value: 500,
      };

      const mockSetting: Settings = {
        id: 'setting-1',
        key: 'firstVisitDiscount',
        value: discountSettings,
      } as Settings;

      mockSettingsRepository.findOne.mockResolvedValue(null);
      mockSettingsRepository.create.mockReturnValue(mockSetting);
      mockSettingsRepository.save.mockResolvedValue(mockSetting);

      const result = await service.setFirstVisitDiscountSettings(discountSettings);

      expect(result.value).toEqual(discountSettings);
    });
  });

  describe('get - с дефолтным значением', () => {
    it('должен вернуть дефолтное значение если настройка не найдена', async () => {
      const key = 'non-existent';
      const defaultValue = 'default';

      mockSettingsRepository.findOne.mockResolvedValue(null);

      const result = await service.get(key, defaultValue);

      expect(result).toBe(defaultValue);
    });
  });

  describe('set - создание новой настройки', () => {
    it('должен создать новую настройку если её нет', async () => {
      const key = 'new-setting';
      const value = 'new-value';
      const mockSetting: Settings = {
        id: 'setting-1',
        key,
        value,
      } as Settings;

      mockSettingsRepository.findOne.mockResolvedValue(null);
      mockSettingsRepository.create.mockReturnValue(mockSetting);
      mockSettingsRepository.save.mockResolvedValue(mockSetting);

      const result = await service.set(key, value);

      expect(result).toEqual(mockSetting);
      expect(mockSettingsRepository.create).toHaveBeenCalledWith({ key, value });
    });
  });
});


