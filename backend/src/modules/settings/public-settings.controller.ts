import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

/** Публичный эндпоинт для веб-приложения: ссылки на условия обслуживания и политику отмены (без авторизации). */
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
}
