import { Injectable } from '@nestjs/common';
import { AuthService, TelegramAuthData } from '../auth.service';

@Injectable()
export class TelegramStrategy {
  constructor(private authService: AuthService) {}

  async validate(data: TelegramAuthData): Promise<any> {
    return await this.authService.validateTelegramAuth(data);
  }
}

