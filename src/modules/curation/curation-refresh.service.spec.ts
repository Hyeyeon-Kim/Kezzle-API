import { CurationRefreshService } from './curation-refresh.service';

describe('CurationRefreshService', () => {
  function staleCuration(id: string) {
    return {
      id,
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    };
  }

  function createMocks(options?: {
    stale?: unknown[];
    claimResults?: (object | null)[];
    config?: Partial<{
      refreshEnabled: boolean;
      refreshIntervalMs: number;
      staleMs: number;
    }>;
  }) {
    const claimQueue = [...(options?.claimResults ?? [])];
    const curationRepository = {
      findStale: jest.fn().mockResolvedValue(options?.stale ?? []),
      claimRefresh: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            claimQueue.length > 0 ? claimQueue.shift() != null : true,
          ),
        ),
    };
    const curationService = {
      updateCuration: jest.fn().mockResolvedValue(undefined),
    };
    const metrics = {
      countRun: jest.fn(),
      countItems: jest.fn(),
      setStaleBacklog: jest.fn(),
    };
    const config = {
      refreshEnabled: true,
      refreshIntervalMs: 600000,
      staleMs: 3 * 24 * 60 * 60 * 1000,
      ...options?.config,
    };
    const schedulerRegistry = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(false),
      deleteInterval: jest.fn(),
    };
    const service = new CurationRefreshService(
      curationRepository as never,
      curationService as never,
      metrics as never,
      config as never,
      schedulerRegistry as never,
    );
    return {
      service,
      curationRepository,
      curationService,
      metrics,
      schedulerRegistry,
    };
  }

  it('refreshes each claimed stale curation exactly once', async () => {
    const { service, curationService, curationRepository } = createMocks({
      stale: [staleCuration('cur-1'), staleCuration('cur-2')],
    });

    const result = await service.runOnce();

    expect(curationRepository.findStale).toHaveBeenCalledWith(expect.any(Date));
    expect(curationService.updateCuration).toHaveBeenCalledTimes(2);
    expect(curationService.updateCuration).toHaveBeenCalledWith('cur-1');
    expect(curationService.updateCuration).toHaveBeenCalledWith('cur-2');
    expect(result).toEqual({ stale: 2, refreshed: 2, skipped: 0, failed: 0 });
  });

  it('claims without touching timestamps and skips already claimed curations', async () => {
    const { service, curationService, curationRepository } = createMocks({
      stale: [staleCuration('cur-1'), staleCuration('cur-2')],
      claimResults: [null, {}],
    });

    const result = await service.runOnce();

    expect(curationRepository.claimRefresh).toHaveBeenCalledWith(
      'cur-1',
      expect.any(Date),
      expect.any(Date),
      expect.any(Date),
    );
    expect(curationService.updateCuration).toHaveBeenCalledTimes(1);
    expect(curationService.updateCuration).toHaveBeenCalledWith('cur-2');
    expect(result).toEqual({ stale: 2, refreshed: 1, skipped: 1, failed: 0 });
  });

  it('keeps refreshing the rest when one curation fails', async () => {
    const { service, curationService } = createMocks({
      stale: [staleCuration('cur-1'), staleCuration('cur-2')],
    });
    curationService.updateCuration.mockRejectedValueOnce(
      new Error('CLIP unavailable'),
    );

    const result = await service.runOnce();

    expect(curationService.updateCuration).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ stale: 2, refreshed: 1, skipped: 0, failed: 1 });
  });

  it('registers the interval with the configured period on bootstrap', () => {
    jest.useFakeTimers();
    try {
      const { service, schedulerRegistry } = createMocks({
        config: { refreshIntervalMs: 1234 },
      });

      service.onApplicationBootstrap();

      expect(schedulerRegistry.addInterval).toHaveBeenCalledTimes(1);
      const [name, interval] = schedulerRegistry.addInterval.mock.calls[0];
      expect(name).toBe('curation-refresh');
      clearInterval(interval);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('falls back to the 10-minute default when the interval is not configured', () => {
    jest.useFakeTimers();
    try {
      const { service, schedulerRegistry } = createMocks();

      service.onApplicationBootstrap();

      expect(schedulerRegistry.addInterval).toHaveBeenCalledTimes(1);
      clearInterval(schedulerRegistry.addInterval.mock.calls[0][1]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not schedule anything when the interval is set to 0', () => {
    const { service, schedulerRegistry } = createMocks({
      config: { refreshEnabled: false },
    });

    service.onApplicationBootstrap();

    expect(schedulerRegistry.addInterval).not.toHaveBeenCalled();
  });

  it('removes the refresh interval during shutdown', () => {
    const { service, schedulerRegistry } = createMocks();
    schedulerRegistry.doesExist.mockReturnValue(true);

    service.onModuleDestroy();

    expect(schedulerRegistry.doesExist).toHaveBeenCalledWith(
      'interval',
      'curation-refresh',
    );
    expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith(
      'curation-refresh',
    );
  });

  it('uses the configured stale threshold when querying stale curations', async () => {
    const staleMs = 60_000;
    const { service, curationRepository } = createMocks({
      config: { staleMs },
    });

    const before = Date.now();
    await service.runOnce();
    const after = Date.now();

    const cutoff = curationRepository.findStale.mock.calls[0][0] as Date;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - staleMs);
    expect(cutoff.getTime()).toBeLessThanOrEqual(after - staleMs);
  });

  it('does not run two executions concurrently', async () => {
    const { service, curationRepository } = createMocks();
    let release: (value: unknown[]) => void = () => undefined;
    curationRepository.findStale.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const first = service.runOnce();
    const second = await service.runOnce();

    expect(second).toEqual({ stale: 0, refreshed: 0, skipped: 0, failed: 0 });
    release([]);
    await expect(first).resolves.toEqual({
      stale: 0,
      refreshed: 0,
      skipped: 0,
      failed: 0,
    });
  });
});
