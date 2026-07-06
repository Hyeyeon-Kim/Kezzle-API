import { MonitoringService } from './monitoring.service';

describe('MonitoringService', () => {
  let service: MonitoringService;

  beforeEach(() => {
    service = new MonitoringService();
  });

  it('exposes prometheus text format with kezzle prefix', async () => {
    service.observeHomeRequest('success', 0.012);
    const output = await service.metrics();

    expect(service.contentType()).toContain('text/plain');
    expect(output).toContain('kezzle_home_requests_total{status="success"} 1');
    expect(output).toContain('kezzle_home_request_duration_seconds_bucket');
    expect(output).toContain('kezzle_process_cpu_user_seconds_total');
  });

  it('counts home requests by status', async () => {
    service.observeHomeRequest('success', 0.005);
    service.observeHomeRequest('success', 0.05);
    service.observeHomeRequest('error', 0.4);

    const output = await service.metrics();
    expect(output).toContain('kezzle_home_requests_total{status="success"} 2');
    expect(output).toContain('kezzle_home_requests_total{status="error"} 1');
  });

  it('records section status with fallback reason', async () => {
    service.observeHomeSection('recommendCakes', 'success', 'none', 0.01);
    service.observeHomeSection('popularCakes', 'fallback', 'timeout', 0.05);
    service.observeHomeSection(
      'anniversary',
      'fallback',
      'dependency_error',
      0.02,
    );

    const output = await service.metrics();
    expect(output).toContain(
      'kezzle_home_section_requests_total{section="recommendCakes",status="success",reason="none"} 1',
    );
    expect(output).toContain(
      'kezzle_home_section_requests_total{section="popularCakes",status="fallback",reason="timeout"} 1',
    );
    expect(output).toContain(
      'kezzle_home_section_requests_total{section="anniversary",status="fallback",reason="dependency_error"} 1',
    );
  });

  it('counts degraded responses, db, ai and cache events', async () => {
    service.countHomeDegraded();
    service.countDbCall('query', 3);
    service.countAiCall('vit', 'requested');
    service.countAiCall('vit', 'error');
    service.countCacheEvent('fresh_hit', 5);
    service.countCacheEvent('error');

    const output = await service.metrics();
    expect(output).toContain('kezzle_home_degraded_total 1');
    expect(output).toContain('kezzle_home_db_calls_total{operation="query"} 3');
    expect(output).toContain(
      'kezzle_home_ai_calls_total{dependency="vit",result="requested"} 1',
    );
    expect(output).toContain(
      'kezzle_home_ai_calls_total{dependency="vit",result="error"} 1',
    );
    expect(output).toContain(
      'kezzle_home_cache_events_total{event="fresh_hit"} 5',
    );
    expect(output).toContain('kezzle_home_cache_events_total{event="error"} 1');
  });

  it('tracks curation job runs, items and stale backlog', async () => {
    service.countCurationRun('success');
    service.countCurationRun('failure');
    service.countCurationItems('refreshed', 4);
    service.countCurationItems('failed', 1);
    service.countCurationItems('skipped', 0);
    service.setCurationStaleBacklog(7);

    const output = await service.metrics();
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
