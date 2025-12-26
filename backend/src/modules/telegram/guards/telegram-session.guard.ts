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
    this.logger.warn(`[TelegramSessionGuard] 🔥 SESSION LOOKUP: userId=${userId}, checking request.session and DB...`);
    this.logger.debug(`TelegramSessionGuard: Проверка активной Telegram сессии для пользователя ${userId}`);

    // КРИТИЧНО: Сначала проверяем request.session (для новых авторизаций)
    let session = this.telegramSessionService.load(request);

    if (session) {
      this.logger.warn(`[TelegramSessionGuard] 🔥 SESSION LOOKUP RESULT: userId=${userId}, found=true, sessionId=${session.sessionId}, source=request.session`);
      this.logger.debug(`TelegramSessionGuard: ✅ Session found in request.session: userId=${session.userId}, sessionId=${session.sessionId}`);
    } else {
      this.logger.warn(`[TelegramSessionGuard] 🔥 SESSION LOOKUP: userId=${userId}, found=false in request.session, checking DB...`);
      this.logger.debug(`TelegramSessionGuard: Session not found in request.session, checking DB for userId=${userId}`);
      
      // Если сессии нет в request.session, ищем в БД по userId из JWT
      try {
        // КРИТИЧНО: getUserSessions для админа возвращает ВСЕ сессии в системе (для UI)
        // Но для Guard нужно искать сессию КОНКРЕТНОГО пользователя
        // Поэтому фильтруем по userId после получения
        const allSessions = await this.telegramUserClientService.getUserSessions(userId);
        
        // КРИТИЧНО: Фильтруем только сессии ТЕКУЩЕГО пользователя
        // (для админа getUserSessions возвращает ВСЕ сессии в системе)
        const userSessions = allSessions.filter(s => s.userId === userId);
        
        this.logger.debug(`TelegramSessionGuard: Found ${userSessions.length} sessions in DB for userId=${userId} (total in system: ${allSessions.length})`);
        
        // Логируем сессии текущего пользователя для отладки
        userSessions.forEach(s => {
          this.logger.debug(`TelegramSessionGuard: User session in DB: id=${s.id}, status=${s.status}, isActive=${s.isActive}, userId=${s.userId}`);
        });
        
        // Ищем активную сессию ТОЛЬКО для текущего пользователя
        const activeSession = userSessions.find(s => s.status === 'active' && s.isActive);
        
        if (activeSession) {
          this.logger.warn(`[TelegramSessionGuard] 🔥 SESSION LOOKUP RESULT: userId=${userId}, found=true, sessionId=${activeSession.id}, source=DB`);
          this.logger.log(`TelegramSessionGuard: ✅ Found active session in DB: ${activeSession.id} for userId=${userId}`);
          
          // КРИТИЧНО: Проверяем, что Telegram клиент подключен и валиден
          // Просто наличие сессии в БД недостаточно - нужно убедиться, что клиент работает
          try {
            const client = await this.telegramUserClientService.getClient(activeSession.id);
            
            if (!client) {
              this.logger.error(`TelegramSessionGuard: ❌ Failed to get client for session ${activeSession.id}`);
              // Сессия найдена, но клиент не может быть создан - возможно данные повреждены
              throw new UnauthorizedException(
                'Telegram session found but client cannot be initialized. Please re-authorize.',
              );
            }
            
            // Проверяем, что клиент подключен
            if (!client.connected) {
              this.logger.warn(`TelegramSessionGuard: Client for session ${activeSession.id} is not connected, attempting to connect...`);
              try {
                await client.connect();
                this.logger.log(`TelegramSessionGuard: ✅ Client connected successfully for session ${activeSession.id}`);
              } catch (connectError: any) {
                this.logger.error(`TelegramSessionGuard: ❌ Failed to connect client for session ${activeSession.id}: ${connectError.message}`);
                throw new UnauthorizedException(
                  'Telegram session found but connection failed. Please re-authorize.',
                );
              }
            } else {
              this.logger.debug(`TelegramSessionGuard: ✅ Client already connected for session ${activeSession.id}`);
            }
            
            // КРИТИЧНО: Валидируем сессию через getMe()
            try {
              await client.invoke({ _: 'users.getFullUser', id: { _: 'inputUserSelf' } });
              this.logger.log(`TelegramSessionGuard: ✅ Session ${activeSession.id} validated successfully via getMe()`);
            } catch (validationError: any) {
              this.logger.error(`TelegramSessionGuard: ❌ Session ${activeSession.id} validation failed: ${validationError.message}`);
              throw new UnauthorizedException(
                'Telegram session is invalid. Please re-authorize via phone or QR code.',
              );
            }
          } catch (error: any) {
            // Если это уже UnauthorizedException - пробрасываем дальше
            if (error instanceof UnauthorizedException) {
              throw error;
            }
            // Иначе логируем и пробрасываем как 401
            this.logger.error(`TelegramSessionGuard: Error validating client for session ${activeSession.id}: ${error.message}`, error.stack);
            throw new UnauthorizedException(
              'Telegram session found but cannot be validated. Please re-authorize.',
            );
          }
          
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
          this.logger.warn(`[TelegramSessionGuard] 🔥 SESSION LOOKUP RESULT: userId=${userId}, found=false, userSessions=${userSessions.length}, sessions=${userSessions.map(s => `${s.id}(${s.status}, active=${s.isActive}, userId=${s.userId})`).join(', ') || 'none'}`);
          this.logger.warn(`TelegramSessionGuard: No active session found in DB for userId=${userId}. User sessions: ${userSessions.map(s => `${s.id}(${s.status}, active=${s.isActive})`).join(', ') || 'none'}`);
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

