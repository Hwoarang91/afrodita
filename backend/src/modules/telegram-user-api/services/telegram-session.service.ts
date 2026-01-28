import { Injectable, Logger } from '@nestjs/common';
import { getErrorMessage, getErrorStack } from '../../../common/utils/error-message';
import { SessionEncryptionService } from './session-encryption.service';
import { SensitiveDataMasker } from '../../../common/utils/sensitive-data-masker';

export interface RequestWithSession {
  session?: object;
}

export interface TelegramSessionPayload {
  userId: string;
  sessionId: string;
  sessionData?: unknown;
  phoneNumber?: string;
  createdAt: number;
}

const SESSION_KEY = 'telegramSession';

@Injectable()
export class TelegramSessionService {
  private readonly logger = new Logger(TelegramSessionService.name);

  constructor(private readonly encryption: SessionEncryptionService) {}

  save(request: RequestWithSession, payload: TelegramSessionPayload): void {
    try {
      if (!request.session) {
        this.logger.warn('[TELEGRAM USER API] request.session is not available.');
        return;
      }

      const encrypted = this.encryption.encrypt(JSON.stringify(payload));
      const s = request.session as Record<string, unknown> | undefined;
      if (s) s[SESSION_KEY] = encrypted;

      const maskedPhone = payload.phoneNumber ? SensitiveDataMasker.maskPhoneNumber(payload.phoneNumber) : 'N/A';
      this.logger.log(
        `[TELEGRAM USER API] Session saved (userId=${payload.userId}, sessionId=${payload.sessionId}, phone=${maskedPhone})`,
      );
    } catch (error: unknown) {
      this.logger.error(`[TELEGRAM USER API] Failed to save session: ${getErrorMessage(error)}`, getErrorStack(error));
      throw error;
    }
  }

  load(request: RequestWithSession): TelegramSessionPayload | null {
    try {
      if (!request.session) {
        this.logger.warn('[TELEGRAM USER API] request.session is not available');
        return null;
      }

      const s = request.session as Record<string, unknown> | undefined;
      const encrypted = s?.[SESSION_KEY];

      if (encrypted == null) return null;
      if (typeof encrypted !== 'string') return null;

      const decryptedString = this.encryption.decrypt(encrypted);
      const decrypted = JSON.parse(decryptedString) as TelegramSessionPayload;
      return decrypted;
    } catch (error: unknown) {
      this.logger.error(`[TELEGRAM USER API] Failed to decrypt session: ${getErrorMessage(error)}`, getErrorStack(error));
      return null;
    }
  }

  clear(request: RequestWithSession): void {
    try {
      const s = request.session as Record<string, unknown> | undefined;
      if (s && SESSION_KEY in s) {
        delete s[SESSION_KEY];
        this.logger.log('[TELEGRAM USER API] Session cleared');
      }
    } catch (error: unknown) {
      this.logger.error(`[TELEGRAM USER API] Failed to clear session: ${getErrorMessage(error)}`, getErrorStack(error));
    }
  }

  has(request: RequestWithSession): boolean {
    const s = request.session as Record<string, unknown> | undefined;
    return !!(s?.[SESSION_KEY]);
  }
}
