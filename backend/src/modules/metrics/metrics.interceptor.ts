/**
 * Собирает HTTP-метрики для Prometheus: количество запросов и длительность (§19).
 * Не учитывает /metrics, /health, /api/docs.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

const SKIP_PATHS = ['/metrics', '/health', '/api/docs'];

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ url?: string; method?: string; route?: { path?: string }; path?: string }>();
    const res = context.switchToHttp().getResponse<{ statusCode: number }>();
    const url = req?.url?.split('?')[0] || req?.path || '';
    if (SKIP_PATHS.some((p) => url === p || url.startsWith(p + '?'))) {
      return next.handle();
    }
    const method = req?.method || 'GET';
    const route = (req?.route as { path?: string } | undefined)?.path || url;
    const start = Date.now();

    return next.handle().pipe(
      finalize(() => {
        const status = res?.statusCode ?? 500;
        this.metricsService.recordRequest(method, route, status, Date.now() - start);
      }),
    );
  }
}
