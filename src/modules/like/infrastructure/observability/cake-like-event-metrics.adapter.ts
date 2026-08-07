import { Inject, Injectable } from '@nestjs/common';
import { Counter, Registry } from 'prom-client';
import { CakeLikeEventMetrics } from 'src/modules/like/application/port/cake-like-event-metrics.port';
import { PROMETHEUS_REGISTRY } from 'src/platform/observability/prometheus/prometheus.constants';

@Injectable()
export class CakeLikeEventMetricsAdapter implements CakeLikeEventMetrics {
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
