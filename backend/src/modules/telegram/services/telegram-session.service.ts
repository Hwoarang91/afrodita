import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage, getErrorStack } from '../../../common/utils/error-message';
import { SessionEncryptionService } from './session-encryption.service';
import { SensitiveDataMasker } from '../../../common/utils/sensitive-data-masker';

/** Request-like объект с session (express-session + кастомные ключи, напр. telegramSession). object совместим с Session & Partial<SessionData>. */
export interface RequestWithSession {
  session?: object;
}

export interface TelegramSessionPayload {
  userId: string;
  sessionId: string; // ID сессии из БД
  sessionData?: unknown; // MTProto session data (опционально, для совместимости)
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
  save(request: RequestWithSession, payload: TelegramSessionPayload): void {
    try {
      // КРИТИЧНО: Инициализируем request.session если его нет
      if (!request.session) {
        this.logger.warn('[TELEGRAM] ⚠️ request.session is not available. Session middleware may not be configured.');
        return;
      }

      const encrypted = this.encryption.encrypt(JSON.stringify(payload));
      const s = request.session as Record<string, unknown> | undefined;
      if (s) s[SESSION_KEY] = encrypted;

      // Используем маскирование для чувствительных данных
      const maskedPhone = payload.phoneNumber ? SensitiveDataMasker.maskPhoneNumber(payload.phoneNumber) : 'N/A';
      this.logger.warn(`[TELEGRAM] 🔥 SESSION SAVED: userId=${payload.userId}, sessionId=${payload.sessionId}, phoneNumber=${maskedPhone}`);
      this.logger.log(
        `[TELEGRAM] ✅ Session saved (userId=${payload.userId}, sessionId=${payload.sessionId})`,
      );
    } catch (error: unknown) {
      this.logger.error(`[TELEGRAM] ❌ Failed to save session: ${getErrorMessage(error)}`, getErrorStack(error));
      throw error;
    }
  }

  /**
   * Загружает Telegram сессию из request.session
   * 
   * @param request Express request объект
   * @returns Расшифрованные данные сессии или null если не найдена
   */
  load(request: RequestWithSession): TelegramSessionPayload | null {
    try {
      if (!request.session) {
        this.logger.warn('[TELEGRAM] ⚠️ request.session is not available');
        return null;
      }

      const s = request.session as Record<string, unknown> | undefined;
      const encrypted = s?.[SESSION_KEY];

      if (encrypted == null) {
        this.logger.warn('[TELEGRAM] ❌ Session not found in request.session');
        return null;
      }
      if (typeof encrypted !== 'string') {
        this.logger.warn('[TELEGRAM] ❌ Session value is not a string');
        return null;
      }

      const decryptedString = this.encryption.decrypt(encrypted);
      const decrypted = JSON.parse(decryptedString) as TelegramSessionPayload;

      this.logger.warn(`[TELEGRAM] 🔥 SESSION LOADED: userId=${decrypted.userId}, sessionId=${decrypted.sessionId}, found=true`);
      this.logger.log(
        `[TELEGRAM] ✅ Session loaded (userId=${decrypted.userId}, sessionId=${decrypted.sessionId})`,
      );

      return decrypted;
    } catch (error: unknown) {
      this.logger.error(`[TELEGRAM] ❌ Failed to decrypt session: ${getErrorMessage(error)}`, getErrorStack(error));
      return null;
    }
  }

  /**
   * Очищает Telegram сессию из request.session
   * 
   * @param request Express request объект
   */
  clear(request: RequestWithSession): void {
    try {
      const s = request.session as Record<string, unknown> | undefined;
      if (s && SESSION_KEY in s) {
        delete s[SESSION_KEY];
        this.logger.warn('[TELEGRAM] 🧹 Session cleared');
      }
    } catch (error: unknown) {
      this.logger.error(`[TELEGRAM] ❌ Failed to clear session: ${getErrorMessage(error)}`, getErrorStack(error));
    }
  }

  /**
   * Проверяет наличие сессии в request.session
   * 
   * @param request Express request объект
   * @returns true если сессия существует, false иначе
   */
  has(request: RequestWithSession): boolean {
    const s = request.session as Record<string, unknown> | undefined;
    return !!(s?.[SESSION_KEY]);
  }
}
