import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { buildErrorResponse } from '../../../common/utils/error-response.builder';
import { ErrorCode } from '../../../common/interfaces/error-response.interface';

@Injectable()
export class SessionEncryptionService {
  private readonly logger = new Logger(SessionEncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits
  private readonly encryptionKey: Buffer;

  constructor(private configService: ConfigService) {
    const key = this.configService.get<string>('TELEGRAM_SESSION_ENCRYPTION_KEY');
    
    if (!key) {
      this.logger.warn(
        'TELEGRAM_SESSION_ENCRYPTION_KEY is not set in environment variables. ' +
        'Generating a random key for development. ' +
        'WARNING: This key will be different on each restart, so encrypted sessions will not be recoverable!'
      );
      // Генерируем случайный ключ для разработки
      this.encryptionKey = crypto.randomBytes(this.keyLength);
    } else {
      // Преобразуем ключ в Buffer (если это hex строка, декодируем, иначе используем как есть)
      if (key.length === 64) {
        // Предполагаем hex формат
        this.encryptionKey = Buffer.from(key, 'hex');
      } else {
        // Используем SHA-256 хеш от ключа для получения 32-байтового ключа
        this.encryptionKey = crypto.createHash('sha256').update(key).digest();
      }

      if (this.encryptionKey.length !== this.keyLength) {
        throw new Error(`Encryption key must be ${this.keyLength} bytes (${this.keyLength * 2} hex characters)`);
      }
    }

    this.logger.log('SessionEncryptionService initialized');
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
    } catch (error: any) {
      this.logger.error(`Error encrypting session data: ${error.message}`, error.stack);
      throw new Error('Failed to encrypt session data');
    }
  }

  /**
   * Расшифровывает данные сессии
   * @param encryptedData Зашифрованные данные в формате: iv:tag:encryptedData
   * @returns Расшифрованные данные (обычно JSON строка)
   * @throws HttpException с ErrorResponse контрактом при ошибках
   */
  decrypt(encryptedData: string | null | undefined): string {
    // КРИТИЧНО: Проверка на null/undefined перед split()
    if (!encryptedData || typeof encryptedData !== 'string' || encryptedData.trim() === '') {
      this.logger.error('SessionEncryptionService.decrypt: encryptedData is null, undefined, or empty');
      const errorResponse = buildErrorResponse(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.SESSION_INVALID,
        'Session data is missing or invalid. Please re-authorize via phone or QR code.',
      );
      throw new HttpException(errorResponse, HttpStatus.UNAUTHORIZED);
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
    } catch (error: any) {
      // Если это уже HttpException с ErrorResponse - пробрасываем как есть
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Для остальных ошибок создаем ErrorResponse
      this.logger.error(`Error decrypting session data: ${error.message}`, error.stack);
      const errorResponse = buildErrorResponse(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.SESSION_INVALID,
        'Failed to decrypt session data. Please re-authorize via phone or QR code.',
      );
      throw new HttpException(errorResponse, HttpStatus.UNAUTHORIZED);
    }
  }
}

