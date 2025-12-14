import { Injectable, NestMiddleware, UnauthorizedException, Logger } from '@nestjs/common';
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
      this.logger.debug('JWT middleware: Проверка cookies', {
        url: req.url,
        method: req.method,
        allCookies: req.cookies,
        hasAccessToken: !!req.cookies?.access_token,
        accessTokenLength: req.cookies?.access_token?.length,
      });

      // Пытаемся получить access token из cookies
      const accessToken = req.cookies?.access_token;

      if (!accessToken) {
        this.logger.debug('JWT middleware: Нет access token в cookies');
        // Нет токена - продолжаем без аутентификации
        return next();
      }

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

        this.logger.log(`JWT middleware: Пользователь ${user.email} аутентифицирован`);
      } else {
        this.logger.warn('JWT middleware: Неверный или истекший access token');
      }

      next();
    } catch (error) {
      this.logger.error('JWT middleware error:', error);
      next();
    }
  }
}
