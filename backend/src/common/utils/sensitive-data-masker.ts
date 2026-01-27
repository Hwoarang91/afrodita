import * as crypto from 'crypto';

/**
 * Утилита для маскирования чувствительных данных в логах
 */
export class SensitiveDataMasker {
  /**
   * Маскирует номер телефона, оставляя только последние 4 цифры
   * @example "+79001234567" -> "+7900****567"
   */
  static maskPhoneNumber(phoneNumber: string | null | undefined): string {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return '[REDACTED]';
    }

    const trimmed = phoneNumber.trim();
    if (trimmed.length <= 4) {
      return '****';
    }

    // Оставляем первые 4 символа (например, "+790") и последние 4 цифры
    const prefix = trimmed.substring(0, Math.min(4, trimmed.length - 4));
    const suffix = trimmed.substring(trimmed.length - 4);
    
    return `${prefix}****${suffix}`;
  }

  /**
   * Полностью скрывает sessionString (данные сессии)
   */
  static maskSessionString(sessionString: string | null | undefined): string {
    if (!sessionString || typeof sessionString !== 'string') {
      return '[REDACTED]';
    }

    // Показываем только длину и первые 8 символов хеша для идентификации
    const hash = crypto.createHash('sha256').update(sessionString).digest('hex').substring(0, 8);
    const length = sessionString.length;
    
    return `[REDACTED:${length}chars:hash=${hash}]`;
  }

  /**
   * Маскирует encryptedSessionData (показывает только hash и длину)
   */
  static maskEncryptedSessionData(encryptedData: string | null | undefined): string {
    if (!encryptedData || typeof encryptedData !== 'string') {
      return '[REDACTED]';
    }

    const trimmed = encryptedData.trim();
    if (trimmed === '' || trimmed === '{}') {
      return '[EMPTY]';
    }

    // Показываем только длину и первые 12 символов для идентификации
    const hash = crypto.createHash('sha256').update(trimmed).digest('hex').substring(0, 12);
    const length = trimmed.length;
    
    return `[ENCRYPTED:${length}chars:hash=${hash}]`;
  }

  /**
   * Маскирует объект с чувствительными полями
   * Автоматически находит и маскирует phoneNumber, sessionString, encryptedSessionData
   */
  static maskObject(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    // Если это массив, маскируем каждый элемент
    if (Array.isArray(obj)) {
      return obj.map(item => this.maskObject(item));
    }

    // Создаем копию объекта
    const masked: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Маскируем phoneNumber
      if (lowerKey.includes('phone')) {
        masked[key] = this.maskPhoneNumber(value as string);
      }
      // Маскируем sessionString
      else if (lowerKey.includes('sessionstring') || lowerKey === 'sessionstring') {
        masked[key] = this.maskSessionString(value as string);
      }
      // Маскируем encryptedSessionData
      else if (lowerKey.includes('encrypted') || lowerKey.includes('sessiondata')) {
        masked[key] = this.maskEncryptedSessionData(value as string);
      }
      // Рекурсивно маскируем вложенные объекты
      else if (value && typeof value === 'object') {
        masked[key] = this.maskObject(value);
      }
      // Остальные поля оставляем как есть
      else {
        masked[key] = value;
      }
    }

    return masked;
  }

  /**
   * Маскирует строку лога, заменяя чувствительные данные
   */
  static maskLogString(logMessage: string): string {
    if (!logMessage || typeof logMessage !== 'string') {
      return logMessage;
    }

    let masked = logMessage;

    // Маскируем phoneNumber в формате phoneNumber=+79001234567 или phone:+79001234567
    masked = masked.replace(
      /(phone(?:Number)?\s*[=:]\s*)(\+?\d{10,15})/gi,
      (match, prefix, phone) => `${prefix}${this.maskPhoneNumber(phone)}`
    );

    // Маскируем sessionString в формате sessionString=...
    masked = masked.replace(
      /(sessionString\s*[=:]\s*)([^\s,}]+)/gi,
      (match, prefix) => `${prefix}${this.maskSessionString('')}`
    );

    // Маскируем encryptedSessionData в формате encryptedSessionData=... или dataLength=...
    masked = masked.replace(
      /(encryptedSessionData\s*[=:]\s*)([^\s,}]+)/gi,
      (match, prefix, data) => `${prefix}${this.maskEncryptedSessionData(data)}`
    );

    return masked;
  }
}

/**
 * Экспорт функции для обратной совместимости
 * Используется в validation-exception.filter.ts и http-exception.filter.ts
 */
export function maskSensitiveData(obj: unknown): unknown {
  return SensitiveDataMasker.maskObject(obj);
}
