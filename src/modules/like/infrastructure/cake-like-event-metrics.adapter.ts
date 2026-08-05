import { Inject, Injectable } from '@nestjs/common';
import { Counter, Registry } from 'prom-client';
import { PROMETHEUS_REGISTRY } from 'src/platform/observability/prometheus/prometheus.constants';

@Injectable()
export class CakeLikeEventMetricsAdapter {
  private readonly recordFailures: Counter;

  constructor(
    @Inject(PROMETHEUS_REGISTRY)
    registry: Registry,
  ) {
    this.recordFailures = new Counter({
      name: 'cake_like_event_record_failures_total',
      help: 'Total cake-like event persistence failures',
      registers: [registry],
    });
  }

  countRecordFailure(): void {
    this.recordFailures.inc();
  }
}
