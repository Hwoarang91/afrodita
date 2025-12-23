import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { TelegramSessionService } from '../../modules/telegram/services/telegram-session.service';

/**
 * Guard для проверки наличия активной Telegram сессии
 * 
 * Проверяет наличие сессии в request.session через TelegramSessionService
 * 
 * КРИТИЧНО: Использует TelegramSessionService.load() для расшифровки сессии
 * НЕ обращается напрямую к request.session.telegramSession
 */
@Injectable()
export class TelegramStrategy implements CanActivate {
  private readonly logger = new Logger(TelegramStrategy.name);

  constructor(
    private readonly telegramSessionService: TelegramSessionService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // КРИТИЧНО: Используем TelegramSessionService для загрузки сессии
    // Сервис сам расшифрует данные из request.session.telegramSession
    const session = this.telegramSessionService.load(request);

    if (!session) {
      this.logger.warn('TelegramStrategy: No active Telegram session found in request.session');
      throw new UnauthorizedException(
        'No active Telegram session found. Please authorize via phone or QR code.',
      );
    }

    // Кладём расшифрованную сессию в request для использования в контроллерах
    request.telegramSession = session;

    this.logger.debug(`TelegramStrategy: ✅ Session validated for userId=${session.userId}, sessionId=${session.sessionId}`);

    return true;
  }
}

