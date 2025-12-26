import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { TelegramSessionService } from '../services/telegram-session.service';
import { TelegramUserClientService } from '../services/telegram-user-client.service';

/**
 * Guard для проверки наличия активной Telegram сессии
 * 
 * Проверяет наличие сессии в следующем порядке:
 * 1. В request.session через TelegramSessionService (для новых авторизаций)
 * 2. В БД через TelegramUserClientService (fallback для существующих сессий)
 * 
 * КРИТИЧНО: Использует TelegramSessionService.load(request) для расшифровки сессии из request.session
 * Если сессии нет в request.session, ищет активную сессию в БД по userId из JWT
 */
@Injectable()
export class TelegramSessionGuard implements CanActivate {
  private readonly logger = new Logger(TelegramSessionGuard.name);

  constructor(
    private readonly telegramSessionService: TelegramSessionService,
    private readonly telegramUserClientService: TelegramUserClientService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // КРИТИЧНО: Сначала проверяем request.session (для новых авторизаций)
    let session = this.telegramSessionService.load(request);

    // Если сессии нет в request.session, ищем в БД по userId из JWT
    if (!session && request.user?.sub) {
      const userId = request.user.sub;
      this.logger.debug(`TelegramSessionGuard: Session not found in request.session, checking DB for userId=${userId}`);
      
      try {
        const sessions = await this.telegramUserClientService.getUserSessions(userId);
        const activeSession = sessions.find(s => s.status === 'active' && s.isActive);
        
        if (activeSession) {
          this.logger.debug(`TelegramSessionGuard: Found active session in DB: ${activeSession.id} for userId=${userId}`);
          
          // Создаем payload для совместимости с TelegramSessionService
          session = {
            userId: userId,
            sessionId: activeSession.id,
            phoneNumber: activeSession.phoneNumber || undefined,
            sessionData: null,
            createdAt: activeSession.createdAt.getTime(),
          };
          
          // Сохраняем в request.session для последующих запросов
          this.telegramSessionService.save(request, session);
        }
      } catch (error: any) {
        this.logger.error(`TelegramSessionGuard: Error loading session from DB: ${error.message}`, error.stack);
      }
    }

    if (!session) {
      this.logger.warn('TelegramSessionGuard: No active Telegram session found in request.session or DB');
      throw new UnauthorizedException(
        'No active Telegram session found. Please authorize via phone or QR code.',
      );
    }

    // Кладём расшифрованную сессию в request для использования в контроллерах
    request.telegramSession = session;
    request.telegramSessionId = session.sessionId;

    this.logger.debug(`TelegramSessionGuard: ✅ Session validated for userId=${session.userId}, sessionId=${session.sessionId}`);

    return true;
  }
}

