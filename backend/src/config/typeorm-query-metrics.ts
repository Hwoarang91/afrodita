/**
 * Связка TypeOrmSlowQueryLogger с Prometheus-метриками (§20).
 * MetricsService вызывает setSlowQueryRecorder в onModuleInit; логгер вызывает recordSlowQuery в logQuerySlow.
 */

let recorder: ((ms: number) => void) | null = null;

export function setSlowQueryRecorder(fn: (ms: number) => void): void {
  recorder = fn;
}

export function recordSlowQuery(ms: number): void {
  recorder?.(ms);
}
