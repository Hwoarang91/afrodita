import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Опциональный JWT guard - не требует токен, но использует его, если он есть
 * Полезно для эндпоинтов, которые могут работать как с авторизацией, так и без неё
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(OptionalJwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // Проверяем, есть ли пользователь в request (установлен JWT middleware)
    if (request.user) {
      this.logger.debug('OptionalJwtAuthGuard: Пользователь уже аутентифицирован middleware');
      return true;
    }

    // Если нет пользователя в request, пытаемся использовать Passport стратегию
    // Но не выбрасываем ошибку, если токена нет
    this.logger.debug('OptionalJwtAuthGuard: Пытаемся использовать Passport стратегию');
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // Если пользователь уже установлен middleware, возвращаем его
    if (request.user) {
      this.logger.debug(`OptionalJwtAuthGuard: Возвращаем пользователя из middleware: ${request.user.email}`);
      return request.user;
    }

    // Если есть ошибка или нет пользователя, но это не критично - просто возвращаем undefined
    // Это позволяет эндпоинту работать без авторизации
    if (err || !user) {
      this.logger.debug('OptionalJwtAuthGuard: Токен не предоставлен или невалиден - продолжаем без авторизации', {
        error: err?.message,
        info: info?.message,
      });
      return undefined; // Возвращаем undefined вместо выброса ошибки
    }

    this.logger.debug(`OptionalJwtAuthGuard: Passport аутентификация успешна: ${user.email}`);
    return user;
  }
}

