import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100, // максимум 100 запросов с одного IP
    message: 'Слишком много запросов с этого IP, попробуйте позже.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  use(req: Request, res: Response, next: NextFunction) {
    this.limiter(req, res, next);
  }
}

// Строгий лимит для аутентификации
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // максимум 5 попыток входа
  message: 'Слишком много попыток входа, попробуйте позже.',
  skipSuccessfulRequests: true,
});

// Лимит для создания записей
export const appointmentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 10, // максимум 10 записей в час
  message: 'Превышен лимит создания записей. Попробуйте позже.',
});

// Строгий лимит для запроса кода подтверждения Telegram
export const telegramPhoneRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 3, // максимум 3 запроса кода с одного IP
  message: 'Слишком много запросов кода подтверждения. Попробуйте позже.',
  skipSuccessfulRequests: false, // Считаем все запросы, даже успешные
  standardHeaders: true,
  legacyHeaders: false,
});

// Лимит для проверки кода подтверждения Telegram
export const telegramPhoneVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10, // максимум 10 попыток проверки кода
  message: 'Слишком много попыток проверки кода. Попробуйте позже.',
  skipSuccessfulRequests: true, // Не считаем успешные попытки
  standardHeaders: true,
  legacyHeaders: false,
});

// Лимит для генерации QR-кода
export const telegramQrGenerateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 минут
  max: 5, // максимум 5 QR-кодов за 5 минут
  message: 'Слишком много запросов QR-кода. Попробуйте позже.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Лимит для проверки статуса QR-кода
export const telegramQrStatusLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 30, // максимум 30 проверок статуса в минуту (для polling)
  message: 'Слишком много запросов статуса QR-кода. Попробуйте позже.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Лимит для проверки 2FA пароля
export const telegram2FALimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // максимум 5 попыток проверки 2FA пароля
  message: 'Слишком много попыток проверки 2FA пароля. Попробуйте позже.',
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

