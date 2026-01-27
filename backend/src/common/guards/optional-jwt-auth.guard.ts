import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { getErrorMessage } from '../utils/error-message';

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

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Проверяем, есть ли пользователь в request (установлен JWT middleware)
    if (request.user) {
      this.logger.debug('OptionalJwtAuthGuard: Пользователь уже аутентифицирован middleware');
      return true;
    }

    // Пытаемся использовать Passport стратегию, но перехватываем ошибки
    // Если токена нет или он невалиден - разрешаем доступ (не выбрасываем ошибку)
    try {
      const result = await super.canActivate(context);
      return result as boolean;
    } catch (error: unknown) {
      // Если Passport выбрасывает ошибку (токен отсутствует или невалиден) - разрешаем доступ
      // Это позволяет эндпоинту работать без авторизации
      this.logger.debug('OptionalJwtAuthGuard: Ошибка при проверке токена - продолжаем без авторизации', {
        error: getErrorMessage(error),
      });
      return true; // Разрешаем доступ даже без токена
    }
  }

  handleRequest(err: unknown, user: unknown, info: unknown, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const u = (x: unknown) => (x as { email?: string; sub?: string })?.email || (x as { email?: string; sub?: string })?.sub;

    // Если пользователь уже установлен middleware, возвращаем его
    if (request.user) {
      this.logger.debug(`OptionalJwtAuthGuard: Возвращаем пользователя из middleware: ${u(request.user)}`);
      return request.user;
    }

    // Если JWT есть и валиден - возвращаем user
    if (user && !err) {
      this.logger.debug(`OptionalJwtAuthGuard: Passport аутентификация успешна: ${u(user)}`);
      return user;
    }

    // Если JWT нет или невалиден - возвращаем null (не выбрасываем ошибку)
    if (err || !user) {
      this.logger.debug('OptionalJwtAuthGuard: Токен не предоставлен или невалиден - продолжаем без авторизации', {
        error: (err as Error)?.message,
        info: (info as { message?: string })?.message,
      });
      return null;
    }

    return null;
  }
}

