import { Injectable, ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Проверяем, есть ли пользователь в request (установлен JWT middleware)
    if (request.user) {
      this.logger.debug('JwtAuthGuard: Пользователь уже аутентифицирован middleware');
      return true;
    }

    // Если нет пользователя в request, используем Passport стратегию
    this.logger.debug('JwtAuthGuard: Используем Passport стратегию');
    try {
      const result = await super.canActivate(context);
      return result as boolean;
    } catch (error) {
      this.logger.warn('JwtAuthGuard: Passport canActivate failed', {
        error: (error as Error)?.message,
      });
      // КРИТИЧНО: Выбрасываем UnauthorizedException вместо возврата false
      // Это гарантирует правильный статус код 401 вместо 403
      throw new UnauthorizedException('Authentication required. Please log in first.');
    }
  }

  handleRequest(err: unknown, user: unknown, info: unknown, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // Если пользователь уже установлен middleware, возвращаем его
    if (request.user) {
      this.logger.debug(`JwtAuthGuard: Возвращаем пользователя из middleware: ${(request.user as { email?: string })?.email}`);
      return request.user;
    }

    // Иначе используем стандартную логику Passport
    if (err || !user) {
      this.logger.warn('JwtAuthGuard: Passport аутентификация не прошла', {
        error: (err as Error)?.message,
        info: (info as { message?: string })?.message,
      });
    } else {
      this.logger.debug(`JwtAuthGuard: Passport аутентификация успешна: ${(user as { email?: string })?.email}`);
    }

    return super.handleRequest(err, user, info, context);
  }
}