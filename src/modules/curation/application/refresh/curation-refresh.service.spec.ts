import { CurationRefreshService } from './curation-refresh.service';

describe('CurationRefreshService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  function staleCuration(id: string) {
    return {
      id,
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    };
  }

  function createMocks(options?: {
    stale?: unknown[];
    claimResults?: (object | null)[];
    policy?: Partial<{
      staleMs: number;
      claimTtlMs: number;
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
    const policy = {
      staleMs: 3 * 24 * 60 * 60 * 1000,
      claimTtlMs: 600000,
      ...options?.policy,
    };
    const service = new CurationRefreshService(
      curationRepository as never,
      curationService as never,
      metrics as never,
      policy,
    );
    return {
      service,
      curationRepository,
      curationService,
      metrics,
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

  it('uses the configured stale threshold when querying stale curations', async () => {
    const staleMs = 60_000;
    const { service, curationRepository } = createMocks({
      policy: { staleMs },
    });

    const before = Date.now();
    await service.runOnce();
    const after = Date.now();

    const cutoff = curationRepository.findStale.mock.calls[0][0] as Date;
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - staleMs);
    expect(cutoff.getTime()).toBeLessThanOrEqual(after - staleMs);
  });

  it('uses the configured claim TTL without changing the curation timestamp', async () => {
    const claimTtlMs = 90_000;
    const { service, curationRepository } = createMocks({
      stale: [staleCuration('cur-1')],
      policy: { claimTtlMs },
    });

    await service.runOnce();

    const [, expectedUpdatedAt, claimedBefore, claimedAt] = curationRepository
      .claimRefresh.mock.calls[0] as [string, Date, Date, Date];
    expect(expectedUpdatedAt).toEqual(new Date('2026-07-01T00:00:00.000Z'));
    expect(claimedAt.getTime() - claimedBefore.getTime()).toBe(claimTtlMs);
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

  it('keeps a cross-instance claim while the first refresh is in flight', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-20T00:00:00.000Z'));
    const stale = staleCuration('cur-1');
    let activeClaim: Date | undefined;
    const curationRepository = {
      findStale: jest.fn().mockResolvedValue([stale]),
      claimRefresh: jest
        .fn()
        .mockImplementation(
          (
            _id: string,
            _expectedUpdatedAt: Date,
            claimedBefore: Date,
            claimedAt: Date,
          ) => {
            if (activeClaim && activeClaim >= claimedBefore) {
              return Promise.resolve(false);
            }
            activeClaim = claimedAt;
            return Promise.resolve(true);
          },
        ),
    };
    let releaseRefresh: () => void = () => undefined;
    let markStarted: () => void = () => undefined;
    const refreshStarted = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const firstCurationService = {
      updateCuration: jest.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            releaseRefresh = resolve;
            markStarted();
          }),
      ),
    };
    const secondCurationService = {
      updateCuration: jest.fn().mockResolvedValue(undefined),
    };
    const metrics = {
      countRun: jest.fn(),
      countItems: jest.fn(),
      setStaleBacklog: jest.fn(),
    };
    const policy = { staleMs: 60_000, claimTtlMs: 10_000 };
    const firstService = new CurationRefreshService(
      curationRepository as never,
      firstCurationService as never,
      metrics as never,
      policy,
    );
    const secondService = new CurationRefreshService(
      curationRepository as never,
      secondCurationService as never,
      metrics as never,
      policy,
    );

    const firstRun = firstService.runOnce();
    await refreshStarted;
    jest.setSystemTime(new Date('2026-07-20T00:00:05.000Z'));

    await expect(secondService.runOnce()).resolves.toEqual({
      stale: 1,
      refreshed: 0,
      skipped: 1,
      failed: 0,
    });
    expect(secondCurationService.updateCuration).not.toHaveBeenCalled();

    releaseRefresh();
    await firstRun;
  });
});
