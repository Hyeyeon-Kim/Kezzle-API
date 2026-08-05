import { Registry } from 'prom-client';
import { CurationRefreshMetricsAdapter } from './curation-refresh-metrics.adapter';

describe('CurationRefreshMetricsAdapter', () => {
  it('keeps run, item, and backlog metric semantics', async () => {
    const registry = new Registry();
    const adapter = new CurationRefreshMetricsAdapter(registry);

    adapter.countRun('success');
    adapter.countRun('failure');
    adapter.countItems('refreshed', 4);
    adapter.countItems('failed', 1);
    adapter.countItems('skipped', 0);
    adapter.setStaleBacklog(7);

    const output = await registry.metrics();
    expect(output).toContain(
      'kezzle_curation_refresh_runs_total{result="success"} 1',
    );
    expect(output).toContain(
      'kezzle_curation_refresh_runs_total{result="failure"} 1',
    );
    expect(output).toContain(
      'kezzle_curation_refresh_items_total{result="refreshed"} 4',
    );
    expect(output).toContain(
      'kezzle_curation_refresh_items_total{result="failed"} 1',
    );
    expect(output).not.toContain(
      'kezzle_curation_refresh_items_total{result="skipped"}',
    );
    expect(output).toContain('kezzle_curation_stale_backlog 7');
  });
});
