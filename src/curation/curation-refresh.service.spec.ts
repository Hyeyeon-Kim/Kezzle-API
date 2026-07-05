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
    const service = new CurationRefreshService(
      curationModel as never,
      curationService as never,
    );
    return { service, curationModel, curationService, findQuery };
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
