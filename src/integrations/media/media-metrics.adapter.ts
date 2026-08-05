import { Inject, Injectable } from '@nestjs/common';
import { Counter, Registry } from 'prom-client';
import { PROMETHEUS_REGISTRY } from 'src/platform/observability/prometheus/prometheus.constants';

export type ObjectStorageOperation = 'put' | 'delete';
export type MediaFeature = 'cake' | 'store';

@Injectable()
export class MediaMetricsAdapter {
  private readonly storageOperationFailures: Counter<'operation'>;
  private readonly objectOrphans: Counter<'feature' | 'operation'>;

  constructor(
    @Inject(PROMETHEUS_REGISTRY)
    registry: Registry,
  ) {
    this.storageOperationFailures = new Counter({
      name: 'object_storage_operation_failures_total',
      help: 'Total object storage operation failures',
      labelNames: ['operation'],
      registers: [registry],
    });
    this.objectOrphans = new Counter({
      name: 'media_object_orphans_total',
      help: 'Total media objects orphaned after cleanup failures',
      labelNames: ['feature', 'operation'],
      registers: [registry],
    });
  }

  countStorageFailure(operation: ObjectStorageOperation): void {
    this.storageOperationFailures.inc({ operation });
  }

  countOrphan(feature: MediaFeature, operation: string): void {
    this.objectOrphans.inc({ feature, operation });
  }
}
