/**
 * Утилиты для маскирования sensitive данных в логах
 * 
 * Гарантирует, что пароли, номера телефонов, sessionId и другие
 * чувствительные данные не попадают в логи в открытом виде
 */

/**
 * Маскирует номер телефона
 * +79377281319 → +7******319
 * 
 * @param phoneNumber - Номер телефона
 * @returns Замаскированный номер
 */
export function maskPhoneNumber(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) return '***';
  
  const cleaned = phoneNumber.replace(/\D/g, '');
  if (cleaned.length <= 3) return '***';
  
  const visibleStart = cleaned.substring(0, 2);
  const visibleEnd = cleaned.substring(cleaned.length - 3);
  const masked = '*'.repeat(Math.max(0, cleaned.length - 5));
  
  return `+${visibleStart}${masked}${visibleEnd}`;
}

/**
 * Маскирует sessionId (показывает только первые 8 символов)
 * 
 * @param sessionId - ID сессии
 * @returns Замаскированный ID
 */
export function maskSessionId(sessionId: string | null | undefined): string {
  if (!sessionId) return '***';
  if (sessionId.length <= 8) return '***';
  return `${sessionId.substring(0, 8)}...`;
}

/**
 * Маскирует пароль (всегда возвращает ***)
 * 
 * @param password - Пароль
 * @returns Замаскированный пароль
 */
export function maskPassword(password: string | null | undefined): string {
  return '***';
}

/**
 * Маскирует email (показывает только домен)
 * user@example.com → ***@example.com
 * 
 * @param email - Email адрес
 * @returns Замаскированный email
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '***';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `***@${domain}`;
}

/**
 * Маскирует все sensitive поля в объекте
 * 
 * @param data - Объект с данными
 * @returns Объект с замаскированными полями
 */
export function maskSensitiveData(data: Record<string, any>): Record<string, any> {
  const masked = { ...data };
  
  if (masked.phoneNumber) {
    masked.phoneNumber = maskPhoneNumber(masked.phoneNumber);
  }
  if (masked.phone) {
    masked.phone = maskPhoneNumber(masked.phone);
  }
  if (masked.sessionId) {
    masked.sessionId = maskSessionId(masked.sessionId);
  }
  if (masked.password) {
    masked.password = maskPassword(masked.password);
  }
  if (masked.email) {
    masked.email = maskEmail(masked.email);
  }
  
  return masked;
}

