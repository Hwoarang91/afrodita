import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Опциональный JWT guard - не требует токен, но использует его, если он есть
 * Полезно для эндпоинтов, которые могут работать как с авторизацией, так и без неё
 * 
 * Поведение:
 * - JWT есть и валиден → req.user доступен
 * - JWT нет → req.user === undefined (не выбрасывает ошибку)
 * - JWT невалиден → req.user === undefined (не выбрасывает ошибку)
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

    // Пытаемся использовать Passport стратегию, но перехватываем ошибки
    // Если токена нет или он невалиден - разрешаем доступ (не выбрасываем ошибку)
    return super.canActivate(context) as Promise<boolean> | boolean;
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // Если пользователь уже установлен middleware, возвращаем его
    if (request.user) {
      this.logger.debug(`OptionalJwtAuthGuard: Возвращаем пользователя из middleware: ${request.user.email || request.user.sub}`);
      return request.user;
    }

    // Если JWT есть и валиден - возвращаем user
    if (user && !err) {
      this.logger.debug(`OptionalJwtAuthGuard: Passport аутентификация успешна: ${user.email || user.sub}`);
      return user;
    }

    // Если JWT нет или невалиден - возвращаем null (не выбрасываем ошибку)
    // Это позволяет эндпоинту работать без авторизации
    if (err || !user) {
      this.logger.debug('OptionalJwtAuthGuard: Токен не предоставлен или невалиден - продолжаем без авторизации', {
        error: err?.message,
        info: info?.message,
      });
      return null; // Возвращаем null вместо выброса ошибки
    }

    return null;
  }
}

