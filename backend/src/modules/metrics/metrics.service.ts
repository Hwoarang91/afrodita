/**
 * Prometheus-метрики для мониторинга (§19, §20).
 * http_requests_total, http_request_duration_seconds; db_slow_queries_total, db_slow_query_duration_seconds.
 * Endpoint /metrics — формат Prometheus (text/plain) для сбора Prometheus/Grafana.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { Registry, Counter, Histogram } from 'prom-client';
import { setSlowQueryRecorder } from '../../config/typeorm-query-metrics';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly register = new Registry();
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly dbSlowQueriesTotal: Counter<string>;
  private readonly dbSlowQueryDurationSeconds: Histogram<string>;

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
    this.dbSlowQueriesTotal = new Counter({
      name: 'db_slow_queries_total',
      help: 'Total DB queries exceeding maxQueryExecutionTime (§20)',
      registers: [this.register],
    });
    this.dbSlowQueryDurationSeconds = new Histogram({
      name: 'db_slow_query_duration_seconds',
      help: 'Duration of slow DB queries in seconds',
      buckets: [0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.register],
    });
  }

  onModuleInit(): void {
    this.register.setDefaultLabels({ app: 'afrodita-backend' });
    setSlowQueryRecorder((ms) => this.recordSlowQuery(ms));
  }

  recordRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    const status = String(statusCode);
    const routeLabel = route || 'unknown';
    this.httpRequestsTotal.inc({ method, route: routeLabel, status });
    this.httpRequestDuration.observe({ method, route: routeLabel }, durationMs / 1000);
  }

  /** Вызывается из TypeOrmSlowQueryLogger.logQuerySlow (§20). */
  recordSlowQuery(timeMs: number): void {
    this.dbSlowQueriesTotal.inc();
    this.dbSlowQueryDurationSeconds.observe(timeMs / 1000);
  }

  async getContent(): Promise<string> {
    return this.register.metrics();
  }

  getContentType(): string {
    return this.register.contentType;
  }
}
