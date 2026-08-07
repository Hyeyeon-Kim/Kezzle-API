import { Inject, Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';
import { PROMETHEUS_REGISTRY } from 'src/platform/observability/prometheus/prometheus.constants';
import {
  AiSearchCallLabels,
  AiSearchCallStatus,
  AiSearchErrorLabels,
  AiSearchMetricsPort,
} from '../../application/ai-search-metrics.port';

@Injectable()
export class AiSearchMetricsAdapter implements AiSearchMetricsPort {
  private readonly callDuration: Histogram<'status' | 'model' | 'endpoint'>;
  private readonly errors: Counter<'reason' | 'model' | 'endpoint'>;

  constructor(
    @Inject(PROMETHEUS_REGISTRY)
    registry: Registry,
  ) {
    this.callDuration = new Histogram({
      name: 'ai_api_call_duration_seconds',
      help: 'Duration of AI API calls (VIT/CLIP)',
      labelNames: ['status', 'model', 'endpoint'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
      registers: [registry],
    });
    this.errors = new Counter({
      name: 'ai_api_errors_total',
      help: 'Total AI API errors (VIT/CLIP)',
      labelNames: ['reason', 'model', 'endpoint'],
      registers: [registry],
    });
  }

  startCall(labels: AiSearchCallLabels): (status: AiSearchCallStatus) => void {
    const endTimer = this.callDuration.startTimer(labels);
    return (status) => endTimer({ status });
  }

  countError(labels: AiSearchErrorLabels): void {
    this.errors.inc(labels);
  }
}
