import { Inject, Injectable } from '@nestjs/common';
import { Counter, Registry } from 'prom-client';
import { MediaMetricsPort } from '../../application/media-metrics.port';
import { ObjectStorageOperation } from '../../application/object-storage.error';
import { PROMETHEUS_REGISTRY } from 'src/platform/observability/prometheus/prometheus.constants';

@Injectable()
export class MediaMetricsAdapter implements MediaMetricsPort {
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

  countOrphan(feature: 'cake' | 'store', operation: string): void {
    this.objectOrphans.inc({ feature, operation });
  }
}
