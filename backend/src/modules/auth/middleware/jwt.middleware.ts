import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtAuthService } from '../services/jwt.service';

export interface RequestWithUser extends Request {
  user?: any;
}

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  private readonly logger = new Logger(JwtMiddleware.name);

  constructor(private readonly jwtService: JwtAuthService) {}

  async use(req: RequestWithUser, res: Response, next: NextFunction) {
    try {
      this.logger.log('JWT middleware: Начинаем проверку', {
        url: req.url,
        method: req.method,
        cookiesKeys: Object.keys(req.cookies || {}),
        hasCookies: !!req.cookies,
      });

      // Пытаемся получить access token из cookies
      const accessToken = req.cookies?.access_token;

      if (!accessToken) {
        this.logger.log('JWT middleware: Нет access_token в cookies, доступные cookies:', req.cookies);
        // Нет токена - продолжаем без аутентификации
        return next();
      }

      this.logger.log('JWT middleware: Найден access_token, пытаемся валидировать');

      // Валидируем access token
      const user = await this.jwtService.validateAccessToken(accessToken);

      if (user) {
        // Токен валиден - добавляем пользователя в request
        req.user = {
          sub: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          bonusPoints: user.bonusPoints,
        };

        this.logger.log(`JWT middleware: ✅ Пользователь ${user.email} (${user.role}) аутентифицирован`);
      } else {
        this.logger.warn('JWT middleware: ❌ Токен не валиден или истек');
      }

      next();
    } catch (error) {
      this.logger.error('JWT middleware error:', error);
      next();
    }
  }
}
