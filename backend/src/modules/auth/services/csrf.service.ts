import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

@Injectable()
export class CsrfService {
  private readonly logger = new Logger(CsrfService.name);

  /**
   * Генерирует CSRF токен
   */
  generateCsrfToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Валидирует CSRF токен (double submit cookie pattern)
   * Сравнивает токен из заголовка с токеном из cookie
   */
  validateCsrfToken(headerToken: string | undefined, cookieToken: string | undefined): boolean {
    if (!headerToken || !cookieToken) {
      this.logger.warn('CSRF токен отсутствует в заголовке или cookie');
      return false;
    }

    if (headerToken !== cookieToken) {
      this.logger.warn('CSRF токены не совпадают');
      return false;
    }

    return true;
  }

  /**
   * Создает CSRF cookie options
   */
  getCsrfCookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    path: string;
    maxAge: number;
  } {
    const isProduction = process.env.NODE_ENV === 'production';

    return {
      httpOnly: false, // CSRF токен должен быть доступен на клиенте
      secure: isProduction,
      sameSite: 'strict', // Защита от CSRF
      path: '/',
      maxAge: 60 * 60 * 24, // 24 часа
    };
  }
}
