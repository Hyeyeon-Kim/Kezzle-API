import { HomeResilienceMetricsService } from './home-resilience-metrics.service';
import { MonitoringService } from 'src/monitoring/monitoring.service';

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
    const service = new HomeResilienceMetricsService(new MonitoringService());

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

  it('does not record home AI counters outside a home request context', () => {
    const monitoring = {
      countAiCall: jest.fn(),
      countDbCall: jest.fn(),
      countCacheEvent: jest.fn(),
    };
    const service = new HomeResilienceMetricsService(monitoring as never);

    service.countAi('clip');
    service.countAiError('clip');

    expect(monitoring.countAiCall).not.toHaveBeenCalled();
  });

  it('records home AI counters inside a home request context', async () => {
    const monitoring = {
      countAiCall: jest.fn(),
      countDbCall: jest.fn(),
      countCacheEvent: jest.fn(),
    };
    const service = new HomeResilienceMetricsService(monitoring as never);

    await service.run(async () => {
      service.countAi('clip');
      service.countAiError('vit', 2);
    });

    expect(monitoring.countAiCall).toHaveBeenCalledWith('clip', 'requested', 1);
    expect(monitoring.countAiCall).toHaveBeenCalledWith('vit', 'error', 2);
  });
});
