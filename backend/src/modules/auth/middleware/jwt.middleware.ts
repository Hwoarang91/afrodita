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
      // Пытаемся получить access token из cookies
      const accessToken = req.cookies?.access_token;

      if (!accessToken) {
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

        this.logger.debug(`JWT middleware: Пользователь ${user.email} аутентифицирован`);
      } else {
        this.logger.debug('JWT middleware: Неверный или истекший access token');
      }

      next();
    } catch (error) {
      this.logger.error('JWT middleware error:', error);
      next();
    }
  }
}
