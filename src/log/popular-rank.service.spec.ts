import { PopularRankService } from './popular-rank.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_STR = /^\d{4}-\d{2}-\d{2}$/;

describe('PopularRankService', () => {
  function createMocks(options?: {
    latestResults?: unknown[];
    docs?: unknown[];
    rankCakes?: unknown[];
  }) {
    const findOneQuery = {
      sort: jest.fn().mockReturnThis(),
      maxTimeMS: jest.fn().mockReturnThis(),
      lean: jest.fn(),
    };
    for (const result of options?.latestResults ?? [null]) {
      findOneQuery.lean.mockResolvedValueOnce(result);
    }
    const findQuery = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maxTimeMS: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(options?.docs ?? []),
    };
    const rankModel = {
      findOne: jest.fn(() => findOneQuery),
      find: jest.fn(() => findQuery),
      insertMany: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn().mockResolvedValue(undefined),
    };
    const logService = {
      getRankCake: jest.fn().mockResolvedValue(options?.rankCakes ?? []),
    };
    const service = new PopularRankService(
      rankModel as never,
      logService as never,
    );
    return { service, rankModel, logService, findQuery };
  }

  function freshBatch(overrides?: Record<string, unknown>) {
    const now = new Date();
    return {
      computedAt: now,
      windowStart: new Date(now.getTime() - 30 * DAY_MS),
      windowEnd: now,
      ...overrides,
    };
  }

  it('serves an empty latest batch without aggregation or a refresh loop', async () => {
    const latest = freshBatch({ isEmptyBatch: true });
    const { service, rankModel, logService, findQuery } = createMocks({
      latestResults: [latest],
    });

    const result = await service.getRanked(NaN, 10, 400);

    expect(logService.getRankCake).not.toHaveBeenCalled();
    expect(rankModel.find).toHaveBeenCalledWith({
      computedAt: latest.computedAt,
      isEmptyBatch: { $ne: true },
    });
    expect(findQuery.limit).toHaveBeenCalledWith(10);
    expect(findQuery.maxTimeMS).toHaveBeenCalledWith(400);
    expect(result.cakes).toEqual([]);
    expect(result.startDate).toMatch(DATE_STR);
    expect(result.endDate).toMatch(DATE_STR);
  });

  it('replaces an older batch with an empty batch marker', async () => {
    const { service, rankModel } = createMocks({ rankCakes: [] });

    await service.refresh();

    expect(rankModel.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        windowStart: expect.any(Date),
        windowEnd: expect.any(Date),
        computedAt: expect.any(Date),
        isEmptyBatch: true,
      }),
    ]);
    expect(rankModel.deleteMany).toHaveBeenCalledWith({
      computedAt: { $lt: expect.any(Date) },
    });
  });
});
