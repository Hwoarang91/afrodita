/**
 * Логгер TypeORM для медленных запросов (§20).
 * При превышении maxQueryExecutionTime вызывается logQuerySlow: лог + recordSlowQuery для Prometheus.
 */

import type { Logger as TypeOrmLogger } from 'typeorm';
import type { QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';
import { recordSlowQuery } from './typeorm-query-metrics';

export class TypeOrmSlowQueryLogger implements TypeOrmLogger {
  constructor(private readonly nestLogger: Logger) {}

  logQuery(_query: string, _parameters?: unknown[], _queryRunner?: QueryRunner): void {}
  logQueryError(_error: string | Error, _query: string, _parameters?: unknown[], _queryRunner?: QueryRunner): void {}
  logQuerySlow(time: number, query: string, parameters?: unknown[], _queryRunner?: QueryRunner): void {
    const params = parameters?.length ? ` [${parameters.length} params]` : '';
    this.nestLogger.warn(`[TypeORM] Slow query (${time}ms): ${query}${params}`);
    recordSlowQuery(time);
  }
  logSchemaBuild(_message: string, _queryRunner?: QueryRunner): void {}
  logMigration(_message: string, _queryRunner?: QueryRunner): void {}
  log(_level: 'log' | 'info' | 'warn', _message: unknown, _queryRunner?: QueryRunner): void {}
}
