import { CurationRefreshService } from './curation-refresh.service';

describe('CurationRefreshService', () => {
  function staleCuration(id: string) {
    return {
      _id: { toString: () => id },
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    };
  }

  function createMocks(options?: {
    stale?: unknown[];
    claimResults?: (object | null)[];
    env?: Record<string, string>;
  }) {
    const findQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(options?.stale ?? []),
    };
    const claimQueue = [...(options?.claimResults ?? [])];
    const curationModel = {
      find: jest.fn(() => findQuery),
      findOneAndUpdate: jest.fn(() => ({
        lean: jest
          .fn()
          .mockResolvedValue(claimQueue.length > 0 ? claimQueue.shift() : {}),
      })),
    };
    const curationService = {
      updateCuration: jest.fn().mockResolvedValue(undefined),
    };
    const monitoring = {
      countCurationRun: jest.fn(),
      countCurationItems: jest.fn(),
      setCurationStaleBacklog: jest.fn(),
    };
    const config = {
      get: jest.fn((key: string) => options?.env?.[key]),
    };
    const schedulerRegistry = {
      addInterval: jest.fn(),
    };
    const service = new CurationRefreshService(
      curationModel as never,
      curationService as never,
      monitoring as never,
      config as never,
      schedulerRegistry as never,
    );
    return {
      service,
      curationModel,
      curationService,
      findQuery,
      monitoring,
      schedulerRegistry,
    };
  }

  it('refreshes each claimed stale curation exactly once', async () => {
    const { service, curationService, curationModel } = createMocks({
      stale: [staleCuration('cur-1'), staleCuration('cur-2')],
    });

    const result = await service.runOnce();

    expect(curationModel.find).toHaveBeenCalledWith({
      updatedAt: { $lt: expect.any(Date) },
    });
    expect(curationService.updateCuration).toHaveBeenCalledTimes(2);
    expect(curationService.updateCuration).toHaveBeenCalledWith('cur-1');
    expect(curationService.updateCuration).toHaveBeenCalledWith('cur-2');
    expect(result).toEqual({ stale: 2, refreshed: 2, skipped: 0, failed: 0 });
  });

  it('claims without touching timestamps and skips already claimed curations', async () => {
    const { service, curationService, curationModel } = createMocks({
      stale: [staleCuration('cur-1'), staleCuration('cur-2')],
      claimResults: [null, {}],
    });

    const result = await service.runOnce();

    expect(curationModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(Date) }),
      { $set: { refreshClaimedAt: expect.any(Date) } },
      { timestamps: false },
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
        env: { CURATION_REFRESH_INTERVAL_MS: '1234' },
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
      env: { CURATION_REFRESH_INTERVAL_MS: '0' },
    });

    service.onApplicationBootstrap();

    expect(schedulerRegistry.addInterval).not.toHaveBeenCalled();
  });

  it('uses the configured stale threshold when querying stale curations', async () => {
    const staleMs = 60_000;
    const { service, curationModel } = createMocks({
      env: { CURATION_STALE_MS: String(staleMs) },
    });

    const before = Date.now();
    await service.runOnce();
    const after = Date.now();

    const findMock = curationModel.find as jest.Mock;
    const cutoff = findMock.mock.calls[0][0]['updatedAt']['$lt'] as Date;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - staleMs);
    expect(cutoff.getTime()).toBeLessThanOrEqual(after - staleMs);
  });

  it('does not run two executions concurrently', async () => {
    const { service, findQuery } = createMocks();
    let release: (value: unknown[]) => void = () => undefined;
    findQuery.lean.mockReturnValue(
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
