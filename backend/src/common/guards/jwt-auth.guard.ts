import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    
    // Логируем для диагностики (временно включаем для всех запросов)
    if (!authHeader) {
      this.logger.warn('Authorization header отсутствует', {
        url: request.url,
        method: request.method,
        headers: Object.keys(request.headers),
      });
    } else {
      this.logger.log('Authorization header присутствует', {
        url: request.url,
        method: request.method,
        hasBearer: authHeader.startsWith('Bearer '),
        tokenLength: authHeader.length,
        tokenPrefix: authHeader.substring(0, 30) + '...',
      });
    }
    
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    if (err || !user) {
      this.logger.warn('JWT валидация не прошла', {
        url: request.url,
        method: request.method,
        error: err?.message,
        info: info?.message,
        hasAuthHeader: !!request.headers.authorization,
      });
    }
    
    return super.handleRequest(err, user, info, context);
  }
}

