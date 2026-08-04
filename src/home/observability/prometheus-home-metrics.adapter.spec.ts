import { Registry } from 'prom-client';
import { PrometheusHomeMetricsAdapter } from './prometheus-home-metrics.adapter';

describe('PrometheusHomeMetricsAdapter', () => {
  const originalEnabled = process.env.HOME_RESILIENCE_METRICS_ENABLED;
  let registry: Registry;
  let adapter: PrometheusHomeMetricsAdapter;

  beforeEach(() => {
    registry = new Registry();
    adapter = new PrometheusHomeMetricsAdapter(registry);
  });

  afterEach(() => {
    adapter.onModuleDestroy();
    if (originalEnabled === undefined) {
      delete process.env.HOME_RESILIENCE_METRICS_ENABLED;
    } else {
      process.env.HOME_RESILIENCE_METRICS_ENABLED = originalEnabled;
    }
    jest.restoreAllMocks();
  });

  it('keeps Home prometheus names, labels, and buckets', async () => {
    adapter.observeRequest('success', 0.012);
    adapter.observeSection('recommendCakes', 'fallback', 'timeout', 0.02);
    adapter.countDegraded();
    adapter.countDb(3);
    adapter.countCache('fresh_hit', 2);
    await adapter.run(async () => {
      adapter.countAi('vit');
      adapter.countAiError('vit');
    });

    const output = await registry.metrics();
    expect(output).toContain('kezzle_home_requests_total{status="success"} 1');
    expect(output).toContain('kezzle_home_request_duration_seconds_bucket');
    expect(output).toContain(
      'kezzle_home_section_requests_total{section="recommendCakes",status="fallback",reason="timeout"} 1',
    );
    expect(output).toContain('kezzle_home_degraded_total 1');
    expect(output).toContain('kezzle_home_db_calls_total{operation="query"} 3');
    expect(output).toContain(
      'kezzle_home_ai_calls_total{dependency="vit",result="requested"} 1',
    );
    expect(output).toContain(
      'kezzle_home_ai_calls_total{dependency="vit",result="error"} 1',
    );
    expect(output).toContain(
      'kezzle_home_cache_events_total{event="fresh_hit"} 2',
    );
  });

  it('keeps refreshes completed outside a request in cumulative totals', async () => {
    process.env.HOME_RESILIENCE_METRICS_ENABLED = 'true';
    const log = jest.spyOn(console, 'log').mockImplementation();

    adapter.countCache('refresh');
    await adapter.run(async () => {
      adapter.countCache('fresh_hit');
      adapter.flush('success');
    });

    const metric = JSON.parse(log.mock.calls[0][0]);
    expect(metric.cache).toMatchObject({ fresh_hit: 1, refresh: 0 });
    expect(metric.cacheTotals).toMatchObject({ fresh_hit: 1, refresh: 1 });
    expect(await registry.metrics()).toContain(
      'kezzle_home_cache_events_total{event="refresh"} 1',
    );
  });

  it('records Home AI only inside a request context', async () => {
    adapter.countAi('clip');
    adapter.countAiError('clip');
    expect(await registry.metrics()).not.toContain(
      'kezzle_home_ai_calls_total{dependency="clip"',
    );

    await adapter.run(async () => {
      adapter.countAi('clip');
      adapter.countAiError('clip', 2);
    });

    const output = await registry.metrics();
    expect(output).toContain(
      'kezzle_home_ai_calls_total{dependency="clip",result="requested"} 1',
    );
    expect(output).toContain(
      'kezzle_home_ai_calls_total{dependency="clip",result="error"} 2',
    );
  });

  it('keeps Prometheus active while disabled JSON flush stays silent', async () => {
    process.env.HOME_RESILIENCE_METRICS_ENABLED = 'false';
    const log = jest.spyOn(console, 'log').mockImplementation();

    await adapter.run(async () => {
      adapter.countDb();
      adapter.countAi('vit');
      adapter.countCache('miss');
      adapter.flush('success');
    });
    adapter.observeRequest('success', 0.01);

    expect(log).not.toHaveBeenCalled();
    const output = await registry.metrics();
    expect(output).toContain('kezzle_home_requests_total{status="success"} 1');
    expect(output).toContain(
      'kezzle_home_ai_calls_total{dependency="vit",result="requested"} 1',
    );
    expect(output).toContain('kezzle_home_cache_events_total{event="miss"} 1');
  });

  it('keeps parallel request JSON contexts isolated', async () => {
    process.env.HOME_RESILIENCE_METRICS_ENABLED = 'true';
    const log = jest.spyOn(console, 'log').mockImplementation();
    let releaseFirst: () => void = () => undefined;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = adapter.run(async () => {
      adapter.countDb();
      adapter.countAi('vit');
      adapter.countCache('fresh_hit');
      await firstBlocked;
      adapter.flush('success');
    });
    const second = adapter.run(async () => {
      adapter.countDb(2);
      adapter.countAi('clip', 2);
      adapter.countCache('miss');
      adapter.flush('error');
      releaseFirst();
    });
    await Promise.all([first, second]);

    const payloads = log.mock.calls
      .map(([message]) => JSON.parse(message))
      .sort((left, right) => left.dbCalls - right.dbCalls);
    expect(payloads).toHaveLength(2);
    expect(payloads[0]).toMatchObject({
      status: 'success',
      dbCalls: 1,
      aiCalls: 1,
      cache: { fresh_hit: 1, miss: 0 },
    });
    expect(payloads[1]).toMatchObject({
      status: 'error',
      dbCalls: 2,
      aiCalls: 2,
      cache: { fresh_hit: 0, miss: 1 },
    });
    expect(payloads[0].requestId).not.toBe(payloads[1].requestId);
  });

  it('disables the event loop delay monitor on module destroy', () => {
    const eventLoopDelay = (
      adapter as unknown as { eventLoopDelay: { disable: () => boolean } }
    ).eventLoopDelay;
    const disable = jest.spyOn(eventLoopDelay, 'disable');

    adapter.onModuleDestroy();

    expect(disable).toHaveBeenCalledTimes(1);
  });
});
