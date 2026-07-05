import { HomeResilienceMetricsService } from './home-resilience-metrics.service';

describe('HomeResilienceMetricsService cache metrics', () => {
  const originalEnabled = process.env.HOME_RESILIENCE_METRICS_ENABLED;

  afterEach(() => {
    if (originalEnabled === undefined) {
      delete process.env.HOME_RESILIENCE_METRICS_ENABLED;
    } else {
      process.env.HOME_RESILIENCE_METRICS_ENABLED = originalEnabled;
    }
    jest.restoreAllMocks();
  });

  it('keeps refreshes that finish outside a request in cumulative totals', async () => {
    process.env.HOME_RESILIENCE_METRICS_ENABLED = 'true';
    const log = jest.spyOn(console, 'log').mockImplementation();
    const service = new HomeResilienceMetricsService();

    service.countCache('refresh');
    await service.run(async () => {
      service.countCache('fresh_hit');
      service.flush('success');
    });

    const metric = JSON.parse(log.mock.calls[0][0]);
    expect(metric.cache).toMatchObject({
      fresh_hit: 1,
      refresh: 0,
    });
    expect(metric.cacheTotals).toMatchObject({
      fresh_hit: 1,
      refresh: 1,
    });
  });
});
