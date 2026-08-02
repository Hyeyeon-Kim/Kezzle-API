import { MetricsService } from './metrics.service';

describe('MetricsService media metrics', () => {
  it('exposes object storage failure counters by operation', async () => {
    const service = new MetricsService();

    service.objectStorageOperationFailures.inc({ operation: 'put' });
    service.objectStorageOperationFailures.inc({ operation: 'delete' });

    await expect(service.registry.metrics()).resolves.toContain(
      'object_storage_operation_failures_total{operation="put"} 1',
    );
    await expect(service.registry.metrics()).resolves.toContain(
      'object_storage_operation_failures_total{operation="delete"} 1',
    );
  });

  it('exposes media orphan counters without object identifiers', async () => {
    const service = new MetricsService();

    service.mediaObjectOrphans.inc({
      feature: 'cake',
      operation: 'replace_previous_image',
    });

    const metrics = await service.registry.metrics();
    expect(metrics).toContain(
      'media_object_orphans_total{feature="cake",operation="replace_previous_image"} 1',
    );
    expect(metrics).not.toContain('storeId');
    expect(metrics).not.toContain('key=');
  });
});
