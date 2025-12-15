import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

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
   */
  decrypt(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivBase64, tagBase64, encrypted] = parts;
      const iv = Buffer.from(ivBase64, 'base64');
      const tag = Buffer.from(tagBase64, 'base64');

      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error: any) {
      this.logger.error(`Error decrypting session data: ${error.message}`, error.stack);
      throw new Error('Failed to decrypt session data');
    }
  }
}

