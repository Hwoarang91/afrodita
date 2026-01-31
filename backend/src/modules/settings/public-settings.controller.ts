import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

/** Публичный эндпоинт для веб-приложения (без авторизации). */
@ApiTags('public')
@Controller('public/settings')
export class PublicSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('booking-terms')
  @ApiOperation({ summary: 'Получить ссылки на условия обслуживания и политику отмены (публично)' })
  async getBookingTerms() {
    const value = await this.settingsService.getBookingTermsSettings();
    return value;
  }

  @Get('business')
  @ApiOperation({ summary: 'Получить адрес салона (публично)' })
  async getBusiness() {
    const address = await this.settingsService.getBusinessAddress();
    return { address };
  }
}
