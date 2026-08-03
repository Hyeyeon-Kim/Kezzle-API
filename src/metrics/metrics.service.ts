import { Inject, Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';
import { PROMETHEUS_REGISTRY } from 'src/observability/prometheus/prometheus.constants';

@Injectable()
export class MetricsService {
  readonly registry: Registry;

  readonly similarSearchDuration: Histogram<'status'>;
  readonly aiApiCallDuration: Histogram<'status' | 'model' | 'endpoint'>;
  readonly storeQueryDuration: Histogram;
  readonly aiApiErrors: Counter<'reason' | 'model' | 'endpoint'>;
  readonly searchEventRecordFailures: Counter;
  readonly cakeLikeEventRecordFailures: Counter;
  readonly objectStorageOperationFailures: Counter<'operation'>;
  readonly mediaObjectOrphans: Counter<'feature' | 'operation'>;

  constructor(
    @Inject(PROMETHEUS_REGISTRY)
    registry: Registry,
  ) {
    this.registry = registry;
    this.similarSearchDuration = new Histogram({
      name: 'similar_search_duration_seconds',
      help: 'Duration of GET /cakes/similar-search endpoint',
      labelNames: ['status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.aiApiCallDuration = new Histogram({
      name: 'ai_api_call_duration_seconds',
      help: 'Duration of AI API calls (VIT/CLIP)',
      labelNames: ['status', 'model', 'endpoint'],
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
      help: 'Total AI API errors (VIT/CLIP)',
      labelNames: ['reason', 'model', 'endpoint'],
      registers: [this.registry],
    });

    this.searchEventRecordFailures = new Counter({
      name: 'search_event_record_failures_total',
      help: 'Total search event persistence failures',
      registers: [this.registry],
    });

    this.cakeLikeEventRecordFailures = new Counter({
      name: 'cake_like_event_record_failures_total',
      help: 'Total cake-like event persistence failures',
      registers: [this.registry],
    });

    this.objectStorageOperationFailures = new Counter({
      name: 'object_storage_operation_failures_total',
      help: 'Total object storage operation failures',
      labelNames: ['operation'],
      registers: [this.registry],
    });

    this.mediaObjectOrphans = new Counter({
      name: 'media_object_orphans_total',
      help: 'Total media objects orphaned after cleanup failures',
      labelNames: ['feature', 'operation'],
      registers: [this.registry],
    });
  }
}
