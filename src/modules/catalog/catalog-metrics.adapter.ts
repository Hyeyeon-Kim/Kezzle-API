import { Inject, Injectable } from '@nestjs/common';
import { Histogram, Registry } from 'prom-client';
import { PROMETHEUS_REGISTRY } from 'src/platform/observability/prometheus/prometheus.constants';

@Injectable()
export class CatalogMetricsAdapter {
  private readonly similarSearchDuration: Histogram<'status'>;
  private readonly storeQueryDuration: Histogram;

  constructor(
    @Inject(PROMETHEUS_REGISTRY)
    registry: Registry,
  ) {
    this.similarSearchDuration = new Histogram({
      name: 'similar_search_duration_seconds',
      help: 'Duration of GET /cakes/similar-search endpoint',
      labelNames: ['status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [registry],
    });
    this.storeQueryDuration = new Histogram({
      name: 'store_query_duration_seconds',
      help: 'Duration of Store batch query in similar()',
      labelNames: [],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
      registers: [registry],
    });
  }

  startSimilarSearch(): (status: 'success' | 'error') => void {
    const endTimer = this.similarSearchDuration.startTimer();
    return (status) => endTimer({ status });
  }

  startStoreQuery(): () => void {
    return this.storeQueryDuration.startTimer();
  }
}
