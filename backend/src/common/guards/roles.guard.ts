import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      this.logger.warn('RolesGuard: Пользователь не аутентифицирован');
      // КРИТИЧНО: Выбрасываем UnauthorizedException вместо возврата false
      // Это гарантирует правильный статус код 401 вместо 403
      throw new UnauthorizedException('Authentication required. Please log in first.');
    }

    const hasRole = requiredRoles.some((role) => user.role?.includes(role));
    if (!hasRole) {
      this.logger.warn(`RolesGuard: У пользователя ${user.email} нет требуемой роли`, {
        userRole: user.role,
        requiredRoles,
      });
      throw new ForbiddenException('Недостаточно прав доступа');
    }

    this.logger.debug(`RolesGuard: Доступ разрешен для ${user.email} с ролью ${user.role}`);
    return true;
  }
}