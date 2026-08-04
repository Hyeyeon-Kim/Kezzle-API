import { Registry } from 'prom-client';
import { MediaMetricsAdapter } from './media-metrics.adapter';

describe('MediaMetricsAdapter', () => {
  it('records object storage failures by semantic operation', async () => {
    const registry = new Registry();
    const metrics = new MediaMetricsAdapter(registry);

    metrics.countStorageFailure('put');
    metrics.countStorageFailure('delete');

    await expect(registry.metrics()).resolves.toContain(
      'object_storage_operation_failures_total{operation="put"} 1',
    );
    await expect(registry.metrics()).resolves.toContain(
      'object_storage_operation_failures_total{operation="delete"} 1',
    );
  });

  it('records media orphans without object identifiers', async () => {
    const registry = new Registry();
    const metrics = new MediaMetricsAdapter(registry);

    metrics.countOrphan('cake', 'replace_previous_image');

    const output = await registry.metrics();
    expect(output).toContain(
      'media_object_orphans_total{feature="cake",operation="replace_previous_image"} 1',
    );
    expect(output).not.toContain('storeId');
    expect(output).not.toContain('key=');
  });
});
