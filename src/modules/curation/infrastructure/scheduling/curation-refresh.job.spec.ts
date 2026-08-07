import { CurationRefreshJob } from './curation-refresh.job';

describe('CurationRefreshJob', () => {
  function createMocks(options?: {
    config?: Partial<{
      refreshEnabled: boolean;
      refreshIntervalMs: number;
      staleMs: number;
    }>;
  }) {
    const refreshService = {
      runOnce: jest.fn().mockResolvedValue({
        stale: 0,
        refreshed: 0,
        skipped: 0,
        failed: 0,
      }),
    };
    const metrics = {
      countRun: jest.fn(),
      countItems: jest.fn(),
      setStaleBacklog: jest.fn(),
    };
    const config = {
      refreshEnabled: true,
      refreshIntervalMs: 600_000,
      staleMs: 3 * 24 * 60 * 60 * 1000,
      ...options?.config,
    };
    const schedulerRegistry = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(false),
      deleteInterval: jest.fn(),
    };
    const job = new CurationRefreshJob(
      refreshService as never,
      metrics as never,
      config as never,
      schedulerRegistry as never,
    );

    return { job, refreshService, metrics, schedulerRegistry };
  }

  it('registers an interval with the configured period on bootstrap', () => {
    jest.useFakeTimers();
    try {
      const { job, schedulerRegistry } = createMocks({
        config: { refreshIntervalMs: 1234 },
      });

      job.onApplicationBootstrap();

      expect(schedulerRegistry.addInterval).toHaveBeenCalledTimes(1);
      const [name, interval] = schedulerRegistry.addInterval.mock.calls[0];
      expect(name).toBe('curation-refresh');
      expect(jest.getTimerCount()).toBe(1);
      clearInterval(interval);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('runs the application refresh service on each interval', async () => {
    jest.useFakeTimers();
    try {
      const { job, refreshService, schedulerRegistry } = createMocks({
        config: { refreshIntervalMs: 1234 },
      });
      job.onApplicationBootstrap();

      jest.advanceTimersByTime(1234);
      await Promise.resolve();

      expect(refreshService.runOnce).toHaveBeenCalledTimes(1);
      clearInterval(schedulerRegistry.addInterval.mock.calls[0][1]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not schedule anything when refresh is disabled', () => {
    const { job, schedulerRegistry } = createMocks({
      config: { refreshEnabled: false },
    });

    job.onApplicationBootstrap();

    expect(schedulerRegistry.addInterval).not.toHaveBeenCalled();
  });

  it('counts a failed run when the application refresh rejects', async () => {
    const { job, refreshService, metrics } = createMocks();
    refreshService.runOnce.mockRejectedValueOnce(new Error('db unavailable'));

    await expect(job.handleInterval()).resolves.toBeUndefined();

    expect(metrics.countRun).toHaveBeenCalledWith('failure');
  });

  it('removes the registered interval during shutdown', () => {
    const { job, schedulerRegistry } = createMocks();
    schedulerRegistry.doesExist.mockReturnValue(true);

    job.onModuleDestroy();

    expect(schedulerRegistry.doesExist).toHaveBeenCalledWith(
      'interval',
      'curation-refresh',
    );
    expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith(
      'curation-refresh',
    );
  });
});
