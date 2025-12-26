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

    // КРИТИЧНО: Проверяем, что пользователь авторизован (JWT)
    if (!request.user?.sub) {
      this.logger.warn('TelegramSessionGuard: Пользователь не авторизован (нет req.user.sub)');
      throw new UnauthorizedException('Authentication required. Please log in first.');
    }

    const userId = request.user.sub;
    this.logger.debug(`TelegramSessionGuard: Проверка активной Telegram сессии для пользователя ${userId}`);

    // КРИТИЧНО: Сначала проверяем request.session (для новых авторизаций)
    let session = this.telegramSessionService.load(request);

    if (session) {
      this.logger.debug(`TelegramSessionGuard: ✅ Session found in request.session: userId=${session.userId}, sessionId=${session.sessionId}`);
    } else {
      this.logger.debug(`TelegramSessionGuard: Session not found in request.session, checking DB for userId=${userId}`);
      
      // Если сессии нет в request.session, ищем в БД по userId из JWT
      try {
        const sessions = await this.telegramUserClientService.getUserSessions(userId);
        this.logger.debug(`TelegramSessionGuard: Found ${sessions.length} sessions in DB for userId=${userId}`);
        
        // Логируем все сессии для отладки
        sessions.forEach(s => {
          this.logger.debug(`TelegramSessionGuard: Session in DB: id=${s.id}, status=${s.status}, isActive=${s.isActive}, userId=${s.userId}`);
        });
        
        const activeSession = sessions.find(s => s.status === 'active' && s.isActive);
        
        if (activeSession) {
          this.logger.log(`TelegramSessionGuard: ✅ Found active session in DB: ${activeSession.id} for userId=${userId}`);
          
          // Создаем payload для совместимости с TelegramSessionService
          session = {
            userId: userId,
            sessionId: activeSession.id,
            phoneNumber: activeSession.phoneNumber || undefined,
            sessionData: null,
            createdAt: activeSession.createdAt.getTime(),
          };
          
          // Сохраняем в request.session для последующих запросов
          try {
            this.telegramSessionService.save(request, session);
            this.logger.log(`TelegramSessionGuard: ✅ Session saved to request.session for future requests`);
          } catch (error: any) {
            this.logger.error(`TelegramSessionGuard: Failed to save session to request.session: ${error.message}`, error.stack);
            // Продолжаем - сессия найдена в БД, это не критично
          }
        } else {
          this.logger.warn(`TelegramSessionGuard: No active session found in DB for userId=${userId}. Sessions: ${sessions.map(s => `${s.id}(${s.status}, active=${s.isActive})`).join(', ')}`);
        }
      } catch (error: any) {
        this.logger.error(`TelegramSessionGuard: Error loading session from DB: ${error.message}`, error.stack);
      }
    }

    if (!session) {
      this.logger.warn(`TelegramSessionGuard: ❌ No active Telegram session found in request.session or DB for userId=${userId}`);
      throw new UnauthorizedException(
        'No active Telegram session found. Please authorize via phone or QR code.',
      );
    }

    // Кладём расшифрованную сессию в request для использования в контроллерах
    request.telegramSession = session;
    request.telegramSessionId = session.sessionId;

    this.logger.log(`TelegramSessionGuard: ✅ Session validated for userId=${session.userId}, sessionId=${session.sessionId}`);

    return true;
  }
}

