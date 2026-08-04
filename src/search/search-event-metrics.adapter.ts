import { Inject, Injectable } from '@nestjs/common';
import { Counter, Registry } from 'prom-client';
import { PROMETHEUS_REGISTRY } from 'src/observability/prometheus/prometheus.constants';

@Injectable()
export class SearchEventMetricsAdapter {
  private readonly recordFailures: Counter;

  constructor(
    @Inject(PROMETHEUS_REGISTRY)
    registry: Registry,
  ) {
    this.recordFailures = new Counter({
      name: 'search_event_record_failures_total',
      help: 'Total search event persistence failures',
      registers: [registry],
    });
  }

  countRecordFailure(): void {
    this.recordFailures.inc();
  }
}
