import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException, Logger, HttpStatus } from '@nestjs/common';
import { TelegramSessionService } from '../services/telegram-session.service';
import { TelegramUserClientService } from '../services/telegram-user-client.service';
import { buildErrorResponse } from '../../../common/utils/error-response.builder';
import { ErrorCode } from '../../../common/interfaces/error-response.interface';

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

    // КРИТИЧНО: Используем request.user.sub (JWT payload.sub) для получения userId
    // Это должно совпадать с userId, который использовался при сохранении сессии
    const userId = request.user.sub;
    
    // Дополнительное логирование для отладки userId
    this.logger.debug(`[TelegramSessionGuard] userId from JWT: sub=${userId}, user.id=${request.user.id || 'N/A'}, user.role=${request.user.role || 'N/A'}`);
    
    if (!userId || typeof userId !== 'string') {
      this.logger.error(`[TelegramSessionGuard] ❌ Invalid userId from JWT: ${JSON.stringify(request.user)}`);
      throw new UnauthorizedException('Invalid user ID in JWT token. Please log in again.');
    }
    
    this.logger.warn(`[TelegramSessionGuard] 🔥 SESSION LOOKUP: userId=${userId}, checking request.session and DB...`);
    this.logger.debug(`TelegramSessionGuard: Проверка активной Telegram сессии для пользователя ${userId}`);

    // КРИТИЧНО: Сначала проверяем request.session (для новых авторизаций)
    let session = this.telegramSessionService.load(request);

    let sessionSource: 'request.session' | 'database' | null = null;
    
    if (session) {
      sessionSource = 'request.session';
      this.logger.log(`[TelegramSessionGuard] ✅ Session found from ${sessionSource}: userId=${userId}, sessionId=${session.sessionId}`);
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
          // КРИТИЧНО: Проверяем, что userId сессии совпадает с userId из JWT
          if (activeSession.userId !== userId) {
            this.logger.error(`[TelegramSessionGuard] ❌ userId mismatch: session.userId=${activeSession.userId}, JWT userId=${userId}`);
            throw new UnauthorizedException(
              'Telegram session userId does not match current user. Please re-authorize.',
            );
          }
          
          sessionSource = 'database';
          this.logger.log(`[TelegramSessionGuard] ✅ Session found from ${sessionSource}: userId=${userId}, sessionId=${activeSession.id}, session.userId=${activeSession.userId}`);
          this.logger.debug(`TelegramSessionGuard: ✅ Found active session in DB: ${activeSession.id} for userId=${userId} (session.userId=${activeSession.userId})`);
          
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
            
            // КРИТИЧНО: Валидируем сессию через getMe() (с retry при FLOOD_WAIT)
            try {
              const { invokeWithRetry } = await import('../utils/mtproto-retry.utils');
              await invokeWithRetry(client, { _: 'users.getFullUser', id: { _: 'inputUserSelf' } });
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
          // КРИТИЧНО: Проверяем, есть ли сессии в других статусах (initializing, invalid)
          // Это позволяет различать NO_SESSION (401) и SESSION_NOT_READY (403)
          const initializingSession = userSessions.find(s => s.status === 'initializing');
          const invalidSession = userSessions.find(s => s.status === 'invalid');
          
          if (initializingSession) {
            // Сессия существует, но еще не активна - это 403, а не 401
            this.logger.warn(`[TelegramSessionGuard] ⚠️ Session found but not ready: userId=${userId}, sessionId=${initializingSession.id}, status=initializing`);
            const errorResponse = buildErrorResponse(
              HttpStatus.FORBIDDEN,
              ErrorCode.TELEGRAM_SESSION_NOT_READY,
              'Telegram session is initializing. Please wait for authorization to complete.',
            );
            throw new ForbiddenException(errorResponse);
          }
          
          if (invalidSession) {
            // Сессия существует, но невалидна - тоже 403
            this.logger.warn(`[TelegramSessionGuard] ⚠️ Session found but invalid: userId=${userId}, sessionId=${invalidSession.id}, status=invalid, reason=${invalidSession.invalidReason || 'N/A'}`);
            const errorResponse = buildErrorResponse(
              HttpStatus.FORBIDDEN,
              ErrorCode.SESSION_INVALID,
              `Telegram session is invalid: ${invalidSession.invalidReason || 'Unknown reason'}. Please re-authorize via phone or QR code.`,
            );
            throw new ForbiddenException(errorResponse);
          }
          
          // Нет сессий вообще - это 401
          this.logger.warn(`[TelegramSessionGuard] 🔥 SESSION LOOKUP RESULT: userId=${userId}, found=false, userSessions=${userSessions.length}, sessions=${userSessions.map(s => `${s.id}(${s.status}, active=${s.isActive}, userId=${s.userId})`).join(', ') || 'none'}`);
          this.logger.warn(`TelegramSessionGuard: No sessions found in DB for userId=${userId}`);
        }
      } catch (error: any) {
        // Если это уже ForbiddenException или UnauthorizedException - пробрасываем дальше
        if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
          throw error;
        }
        this.logger.error(`TelegramSessionGuard: Error loading session from DB: ${error.message}`, error.stack);
      }
    }

    // КРИТИЧНО: Если сессия не найдена, проверяем статус сессий в БД для правильного кода ошибки
    if (!session) {
      try {
        const allSessions = await this.telegramUserClientService.getUserSessions(userId);
        const userSessions = allSessions.filter(s => s.userId === userId);
        
        const initializingSession = userSessions.find(s => s.status === 'initializing');
        const invalidSession = userSessions.find(s => s.status === 'invalid');
        
        if (initializingSession) {
          this.logger.warn(`[TelegramSessionGuard] ⚠️ Session found but not ready (final check): userId=${userId}, sessionId=${initializingSession.id}, status=initializing`);
          const errorResponse = buildErrorResponse(
            HttpStatus.FORBIDDEN,
            ErrorCode.TELEGRAM_SESSION_NOT_READY,
            'Telegram session is initializing. Please wait for authorization to complete.',
          );
          throw new ForbiddenException(errorResponse);
        }
        
        if (invalidSession) {
          this.logger.warn(`[TelegramSessionGuard] ⚠️ Session found but invalid (final check): userId=${userId}, sessionId=${invalidSession.id}, status=invalid`);
          const errorResponse = buildErrorResponse(
            HttpStatus.FORBIDDEN,
            ErrorCode.SESSION_INVALID,
            `Telegram session is invalid: ${invalidSession.invalidReason || 'Unknown reason'}. Please re-authorize via phone or QR code.`,
          );
          throw new ForbiddenException(errorResponse);
        }
      } catch (error: any) {
        // Если это уже ForbiddenException - пробрасываем дальше
        if (error instanceof ForbiddenException) {
          throw error;
        }
        // Иначе логируем и продолжаем с 401
        this.logger.debug(`TelegramSessionGuard: Error checking session status: ${error.message}`);
      }
      
      // Нет сессий вообще - это 401 NO_SESSION
      this.logger.warn(`TelegramSessionGuard: ❌ No Telegram session found (NO_SESSION) for userId=${userId}`);
      const errorResponse = buildErrorResponse(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.SESSION_NOT_FOUND,
        'No Telegram session found. Please authorize via phone or QR code.',
      );
      throw new UnauthorizedException(errorResponse);
    }

    // Кладём расшифрованную сессию в request для использования в контроллерах
    request.telegramSession = session;
    request.telegramSessionId = session.sessionId;

    // КРИТИЧНО: Логируем источник сессии для отладки
    this.logger.log(`[TelegramSessionGuard] ✅ Session validated: userId=${session.userId}, sessionId=${session.sessionId}, source=${sessionSource || 'unknown'}`);

    return true;
  }
}

