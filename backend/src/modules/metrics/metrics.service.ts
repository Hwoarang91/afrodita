/**
 * Prometheus-метрики для мониторинга (§19).
 * http_requests_total, http_request_duration_seconds.
 * Endpoint /metrics — формат Prometheus (text/plain) для сбора Prometheus/Grafana.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { Registry, Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly register = new Registry();
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;

  constructor() {
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.register],
    });
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.register],
    });
  }

  onModuleInit(): void {
    this.register.setDefaultLabels({ app: 'afrodita-backend' });
  }

  recordRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    const status = String(statusCode);
    const routeLabel = route || 'unknown';
    this.httpRequestsTotal.inc({ method, route: routeLabel, status });
    this.httpRequestDuration.observe({ method, route: routeLabel }, durationMs / 1000);
  }

  async getContent(): Promise<string> {
    return this.register.metrics();
  }

  getContentType(): string {
    return this.register.contentType;
  }
}
