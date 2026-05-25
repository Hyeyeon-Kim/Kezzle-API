import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService {
  readonly registry: Registry;

  readonly similarSearchDuration: Histogram<'status'>;
  readonly aiApiCallDuration: Histogram<'status'>;
  readonly storeQueryDuration: Histogram;
  readonly aiApiErrors: Counter<'reason'>;

  constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry });

    this.similarSearchDuration = new Histogram({
      name: 'similar_search_duration_seconds',
      help: 'Duration of GET /cakes/similar-search endpoint',
      labelNames: ['status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.aiApiCallDuration = new Histogram({
      name: 'ai_api_call_duration_seconds',
      help: 'Duration of AI API (VIT) calls in similar()',
      labelNames: ['status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.storeQueryDuration = new Histogram({
      name: 'store_query_duration_seconds',
      help: 'Duration of Store batch query in similar()',
      labelNames: [],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
      registers: [this.registry],
    });

    this.aiApiErrors = new Counter({
      name: 'ai_api_errors_total',
      help: 'Total AI API errors in similar()',
      labelNames: ['reason'],
      registers: [this.registry],
    });
  }
}
