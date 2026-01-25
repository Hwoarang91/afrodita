import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { getErrorMessage, getErrorStack } from '../../../common/utils/error-message';
import { buildErrorResponse } from '../../../common/utils/error-response.builder';
import { ErrorCode } from '../../../common/interfaces/error-response.interface';

@Injectable()
export class SessionEncryptionService {
  private readonly logger = new Logger(SessionEncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly encryptionKey: Buffer;

  constructor(private configService: ConfigService) {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const key = this.configService.get<string>('TELEGRAM_SESSION_ENCRYPTION_KEY');
    
    // КРИТИЧНО: В продакшене ключ обязателен
    if (!key || key.trim().length === 0) {
      const errorMessage = 
        'TELEGRAM_SESSION_ENCRYPTION_KEY is required in environment variables. ' +
        'Generate a secure 32-byte (64 hex characters) key using: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"';
      
      if (nodeEnv === 'production') {
        this.logger.error(errorMessage);
        throw new Error(
          'TELEGRAM_SESSION_ENCRYPTION_KEY is required in production. ' +
          'Please set it in your environment variables before starting the application.'
        );
      } else {
        // В development только предупреждаем, но все равно требуем ключ
        this.logger.error(errorMessage);
        throw new Error(
          'TELEGRAM_SESSION_ENCRYPTION_KEY is required. ' +
          'Please set it in your .env file. For development, generate a key using: ' +
          'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
      }
    }

    // Валидация минимальной длины ключа (минимум 32 символа для текста или 64 для hex)
    const trimmedKey = key.trim();
    const minLength = 32; // Минимум 32 символа для достаточной энтропии
    
    if (trimmedKey.length < minLength) {
      throw new Error(
        `TELEGRAM_SESSION_ENCRYPTION_KEY must be at least ${minLength} characters long. ` +
        `Current length: ${trimmedKey.length}. ` +
        'For hex format, use 64 characters (32 bytes). ' +
        'For text format, use at least 32 characters (will be hashed with SHA-256).'
      );
    }

    // Преобразуем ключ в Buffer
    if (trimmedKey.length === 64 && /^[0-9a-fA-F]+$/.test(trimmedKey)) {
      // Hex формат (64 символа) - декодируем напрямую
      this.encryptionKey = Buffer.from(trimmedKey, 'hex');
      this.logger.log('Using hex-encoded encryption key (64 characters)');
    } else {
      // Текстовый формат - используем SHA-256 хеш для получения 32-байтового ключа
      // Это позволяет использовать человекочитаемые пароли, но с достаточной длиной
      this.encryptionKey = crypto.createHash('sha256').update(trimmedKey, 'utf8').digest();
      this.logger.log(`Using text-based encryption key (hashed with SHA-256), original length: ${trimmedKey.length}`);
    }

    // Финальная проверка длины (должна быть 32 байта)
    if (this.encryptionKey.length !== this.keyLength) {
      throw new Error(
        `Encryption key must produce ${this.keyLength} bytes after processing. ` +
        `Got ${this.encryptionKey.length} bytes. This should never happen - please report this bug.`
      );
    }

    this.logger.log('SessionEncryptionService initialized with secure encryption key');
  }

  /**
   * Шифрует данные сессии
   * @param data Данные для шифрования (обычно JSON строка)
   * @returns Зашифрованные данные в формате: iv:tag:encryptedData (все в base64)
   */
  encrypt(data: string): string {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

      let encrypted = cipher.update(data, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      const tag = cipher.getAuthTag();

      // Формат: iv:tag:encryptedData (все в base64)
      return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`;
    } catch (error: unknown) {
      this.logger.error(`Error encrypting session data: ${getErrorMessage(error)}`, getErrorStack(error));
      throw new Error('Failed to encrypt session data');
    }
  }

  /**
   * Расшифровывает данные сессии
   * @param encryptedData Зашифрованные данные в формате: iv:tag:encryptedData
   * @returns Расшифрованные данные (обычно JSON строка) или null для пустых данных
   * @throws HttpException с ErrorResponse контрактом при ошибках расшифровки
   */
  decrypt(encryptedData: string | null | undefined): string {
    // КРИТИЧНО: Для пустых данных возвращаем пустой JSON объект
    // Это нужно для сессий в статусе 'initializing', где encryptedSessionData === null допустимо
    if (!encryptedData || typeof encryptedData !== 'string' || encryptedData.trim() === '') {
      this.logger.debug('SessionEncryptionService.decrypt: encryptedData is empty, returning empty object');
      return '{}';
    }

    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        this.logger.error(`SessionEncryptionService.decrypt: Invalid encrypted data format. Expected 3 parts, got ${parts.length}`);
        const errorResponse = buildErrorResponse(
          HttpStatus.UNAUTHORIZED,
          ErrorCode.SESSION_INVALID,
          'Invalid session data format. Please re-authorize via phone or QR code.',
        );
        throw new HttpException(errorResponse, HttpStatus.UNAUTHORIZED);
      }

      const [ivBase64, tagBase64, encrypted] = parts;
      
      // Проверка на пустые части
      if (!ivBase64 || !tagBase64 || !encrypted) {
        this.logger.error('SessionEncryptionService.decrypt: Empty parts in encrypted data');
        const errorResponse = buildErrorResponse(
          HttpStatus.UNAUTHORIZED,
          ErrorCode.SESSION_INVALID,
          'Invalid session data: missing required parts. Please re-authorize via phone or QR code.',
        );
        throw new HttpException(errorResponse, HttpStatus.UNAUTHORIZED);
      }

      const iv = Buffer.from(ivBase64, 'base64');
      const tag = Buffer.from(tagBase64, 'base64');

      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error decrypting session data: ${getErrorMessage(error)}`, getErrorStack(error));
      const errorResponse = buildErrorResponse(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.SESSION_INVALID,
        'Failed to decrypt session data. Please re-authorize via phone or QR code.',
      );
      throw new HttpException(errorResponse, HttpStatus.UNAUTHORIZED);
    }
  }

  /**
   * Безопасная расшифровка с возвратом null при ошибках
   * Используется в местах, где ошибка расшифровки не критична
   */
  decryptSafe(encryptedData: string | null | undefined): string | null {
    try {
      const result = this.decrypt(encryptedData);
      return result === '{}' ? null : result;
    } catch (error) {
      this.logger.debug(`decryptSafe: returning null due to error`);
      return null;
    }
  }
}

