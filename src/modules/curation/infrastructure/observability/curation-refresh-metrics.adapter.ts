import { Inject, Injectable } from '@nestjs/common';
import { Counter, Gauge, Registry } from 'prom-client';
import {
  CurationItemResult,
  CurationRefreshMetrics,
  CurationRunResult,
} from 'src/modules/curation/application/port/curation-refresh-metrics.port';
import { PROMETHEUS_REGISTRY } from 'src/platform/observability/prometheus/prometheus.constants';

@Injectable()
export class CurationRefreshMetricsAdapter implements CurationRefreshMetrics {
  private readonly curationRuns = new Counter({
    name: 'kezzle_curation_refresh_runs_total',
    help: 'Curation refresh job runs by result',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });

  private readonly curationItems = new Counter({
    name: 'kezzle_curation_refresh_items_total',
    help: 'Curation refresh item outcomes',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });

  private readonly curationStaleBacklog = new Gauge({
    name: 'kezzle_curation_stale_backlog',
    help: 'Stale curations found by the last refresh job run',
    registers: [this.registry],
  });

  constructor(
    @Inject(PROMETHEUS_REGISTRY)
    private readonly registry: Registry,
  ) {}

  countRun(result: CurationRunResult): void {
    this.curationRuns.inc({ result });
  }

  countItems(result: CurationItemResult, count: number): void {
    if (count > 0) {
      this.curationItems.inc({ result }, count);
    }
  }

  setStaleBacklog(count: number): void {
    this.curationStaleBacklog.set(count);
  }
}
