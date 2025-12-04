import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from '../../entities/settings.entity';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(Settings)
    private settingsRepository: Repository<Settings>,
  ) {}

  async get(key: string, defaultValue: any = null): Promise<any> {
    const setting = await this.settingsRepository.findOne({
      where: { key },
    });
    return setting ? setting.value : defaultValue;
  }

  async set(key: string, value: any): Promise<Settings> {
    let setting = await this.settingsRepository.findOne({
      where: { key },
    });

    if (setting) {
      setting.value = value;
      return await this.settingsRepository.save(setting);
    } else {
      setting = this.settingsRepository.create({ key, value });
      return await this.settingsRepository.save(setting);
    }
  }

  async getBookingSettings(): Promise<{
    manualConfirmation: boolean;
    minAdvanceBooking: number;
    maxAdvanceBooking: number;
    cancellationDeadline: number;
  }> {
    const settings = await this.settingsRepository.findOne({
      where: { key: 'bookingSettings' },
    });

    if (settings) {
      this.logger.debug('Загружены настройки bookingSettings из БД');
      return settings.value;
    }

    // Дефолтные значения
    this.logger.debug('Используются дефолтные настройки bookingSettings (manualConfirmation: false)');
    return {
      manualConfirmation: false,
      minAdvanceBooking: 2,
      maxAdvanceBooking: 30,
      cancellationDeadline: 24,
    };
  }

  async setBookingSettings(settings: {
    manualConfirmation: boolean;
    minAdvanceBooking: number;
    maxAdvanceBooking: number;
    cancellationDeadline: number;
  }): Promise<Settings> {
    this.logger.debug('Сохранение настроек bookingSettings');
    const result = await this.set('bookingSettings', settings);
    this.logger.debug('Настройки bookingSettings успешно сохранены');
    return result;
  }

  async getFirstVisitDiscountSettings(): Promise<{
    enabled: boolean;
    type: 'percent' | 'fixed'; // 'percent' - в процентах, 'fixed' - в рублях
    value: number; // Значение скидки (процент или рубли)
  }> {
    const settings = await this.settingsRepository.findOne({
      where: { key: 'firstVisitDiscount' },
    });

    if (settings) {
      return settings.value;
    }

    // Дефолтные значения
    return {
      enabled: false,
      type: 'percent',
      value: 0,
    };
  }

  async setFirstVisitDiscountSettings(settings: {
    enabled: boolean;
    type: 'percent' | 'fixed';
    value: number;
  }): Promise<Settings> {
    return await this.set('firstVisitDiscount', settings);
  }
}

