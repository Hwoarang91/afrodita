import { Injectable, Logger } from '@nestjs/common';
import { SessionEncryptionService } from './session-encryption.service';

export interface TelegramSessionPayload {
  userId: string;
  sessionId: string; // ID сессии из БД
  sessionData: any; // MTProto session data (опционально, для совместимости)
  phoneNumber?: string;
  createdAt: number;
}

const SESSION_KEY = 'telegramSession';

/**
 * Единый сервис для управления Telegram сессиями
 * 
 * Является ЕДИНСТВЕННЫМ владельцем сессии в request.session
 * 
 * Архитектурные гарантии:
 * - НИКТО кроме этого сервиса не трогает request.session.telegramSession
 * - Guard не знает про encryption
 * - Controller не знает, где хранится session
 * - Один ключ: request.session.telegramSession
 * 
 * Внутри использует:
 * - SessionEncryptionService для шифрования/дешифрования
 * - request.session для хранения (Express session)
 */
@Injectable()
export class TelegramSessionService {
  private readonly logger = new Logger(TelegramSessionService.name);

  constructor(
    private readonly encryption: SessionEncryptionService,
  ) {}

  /**
   * Сохраняет Telegram сессию в request.session
   * 
   * @param request Express request объект
   * @param payload Данные сессии для сохранения
   */
  save(request: any, payload: TelegramSessionPayload): void {
    try {
      // КРИТИЧНО: Инициализируем request.session если его нет
      if (!request.session) {
        this.logger.warn('[TELEGRAM] ⚠️ request.session is not available. Session middleware may not be configured.');
        return;
      }

      const encrypted = this.encryption.encrypt(JSON.stringify(payload));

      request.session[SESSION_KEY] = encrypted;

      this.logger.log(
        `[TELEGRAM] ✅ Session saved (userId=${payload.userId}, sessionId=${payload.sessionId})`,
      );
    } catch (error: any) {
      this.logger.error(`[TELEGRAM] ❌ Failed to save session: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Загружает Telegram сессию из request.session
   * 
   * @param request Express request объект
   * @returns Расшифрованные данные сессии или null если не найдена
   */
  load(request: any): TelegramSessionPayload | null {
    try {
      if (!request.session) {
        this.logger.warn('[TELEGRAM] ⚠️ request.session is not available');
        return null;
      }

      const encrypted = request.session?.[SESSION_KEY];

      if (!encrypted) {
        this.logger.warn('[TELEGRAM] ❌ Session not found in request.session');
        return null;
      }

      const decryptedString = this.encryption.decrypt(encrypted);
      const decrypted = JSON.parse(decryptedString) as TelegramSessionPayload;

      this.logger.log(
        `[TELEGRAM] ✅ Session loaded (userId=${decrypted.userId}, sessionId=${decrypted.sessionId})`,
      );

      return decrypted;
    } catch (error: any) {
      this.logger.error(`[TELEGRAM] ❌ Failed to decrypt session: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Очищает Telegram сессию из request.session
   * 
   * @param request Express request объект
   */
  clear(request: any): void {
    try {
      if (request.session && request.session[SESSION_KEY]) {
        delete request.session[SESSION_KEY];
        this.logger.warn('[TELEGRAM] 🧹 Session cleared');
      }
    } catch (error: any) {
      this.logger.error(`[TELEGRAM] ❌ Failed to clear session: ${error.message}`, error.stack);
    }
  }

  /**
   * Проверяет наличие сессии в request.session
   * 
   * @param request Express request объект
   * @returns true если сессия существует, false иначе
   */
  has(request: any): boolean {
    return !!(request.session?.[SESSION_KEY]);
  }
}
