import { Injectable, Logger } from '@nestjs/common';
import { TelegramUserClientService } from './telegram-user-client.service';
import { TelegramUserSession } from '../../../entities/telegram-user-session.entity';

/**
 * Единый сервис для управления Telegram сессиями
 * 
 * Является центральной точкой для:
 * - Сохранения сессий после авторизации
 * - Загрузки активных сессий
 * - Очистки сессий
 * - Интеграции с guard и контроллерами
 * 
 * Внутри использует:
 * - TelegramUserClientService для работы с БД
 * - SessionEncryptionService для шифрования (через TelegramUserClientService)
 */
@Injectable()
export class TelegramSessionService {
  private readonly logger = new Logger(TelegramSessionService.name);

  constructor(private readonly telegramUserClientService: TelegramUserClientService) {}

  /**
   * Сохраняет Telegram сессию после успешной авторизации
   * 
   * @param userId ID пользователя
   * @param client MTKruto Client (уже авторизованный)
   * @param sessionId ID сессии
   * @param phoneNumber Номер телефона
   * @param ipAddress IP адрес (опционально)
   * @param userAgent User Agent (опционально)
   */
  async save(
    userId: string,
    client: any, // Client from @mtkruto/node
    sessionId: string,
    phoneNumber: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    this.logger.log(`[TELEGRAM] session save requested for user ${userId}, sessionId: ${sessionId}, phone: ${phoneNumber}`);
    
    try {
      await this.telegramUserClientService.saveSession(
        userId,
        client,
        sessionId,
        phoneNumber,
        ipAddress,
        userAgent,
      );
      
      this.logger.log(`[TELEGRAM] ✅ session saved successfully for user ${userId}, sessionId: ${sessionId}`);
    } catch (error: any) {
      this.logger.error(`[TELEGRAM] ❌ session save failed for user ${userId}, sessionId: ${sessionId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Загружает активную Telegram сессию для пользователя
   * 
   * @param userId ID пользователя
   * @returns Активная сессия или null если не найдена
   */
  async load(userId: string): Promise<TelegramUserSession | null> {
    this.logger.debug(`[TELEGRAM] session load requested for user ${userId}`);
    
    try {
      const sessions = await this.telegramUserClientService.getUserSessions(userId);
      
      // Ищем активную сессию (status === 'active' && isActive === true)
      const activeSession = sessions.find(s => s.status === 'active' && s.isActive);
      
      if (activeSession) {
        this.logger.log(`[TELEGRAM] ✅ session loaded for user ${userId}, sessionId: ${activeSession.id}`);
        return activeSession;
      } else {
        this.logger.warn(`[TELEGRAM] ⚠️ session missing for user ${userId}. Всего сессий: ${sessions.length}`);
        if (sessions.length > 0) {
          const statuses = sessions.map(s => `${s.id}: ${s.status}/${s.isActive}`).join(', ');
          this.logger.debug(`[TELEGRAM] Статусы сессий: ${statuses}`);
        }
        return null;
      }
    } catch (error: any) {
      this.logger.error(`[TELEGRAM] ❌ session load failed for user ${userId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Очищает (деактивирует) Telegram сессию
   * 
   * @param userId ID пользователя
   * @param sessionId ID сессии для деактивации (опционально, если не указан - деактивирует все сессии пользователя)
   */
  async clear(userId: string, sessionId?: string): Promise<void> {
    this.logger.log(`[TELEGRAM] session clear requested for user ${userId}, sessionId: ${sessionId || 'all'}`);
    
    try {
      if (sessionId) {
        // Деактивируем конкретную сессию
        await this.telegramUserClientService.deactivateSession(userId, sessionId, false);
        this.logger.log(`[TELEGRAM] ✅ session cleared for user ${userId}, sessionId: ${sessionId}`);
      } else {
        // Деактивируем все сессии пользователя
        const sessions = await this.telegramUserClientService.getUserSessions(userId);
        for (const session of sessions) {
          if (session.isActive) {
            await this.telegramUserClientService.deactivateSession(userId, session.id, false);
          }
        }
        this.logger.log(`[TELEGRAM] ✅ all sessions cleared for user ${userId}`);
      }
    } catch (error: any) {
      this.logger.error(`[TELEGRAM] ❌ session clear failed for user ${userId}, sessionId: ${sessionId || 'all'}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Проверяет наличие активной сессии для пользователя
   * 
   * @param userId ID пользователя
   * @returns true если есть активная сессия, false иначе
   */
  async hasActiveSession(userId: string): Promise<boolean> {
    const session = await this.load(userId);
    return session !== null;
  }

  /**
   * Получает ID активной сессии для пользователя
   * 
   * @param userId ID пользователя
   * @returns ID активной сессии или null если не найдена
   */
  async getActiveSessionId(userId: string): Promise<string | null> {
    const session = await this.load(userId);
    return session?.id || null;
  }
}

