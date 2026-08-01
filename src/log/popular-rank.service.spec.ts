import { PopularRankService } from './popular-rank.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_STR = /^\d{4}-\d{2}-\d{2}$/;

describe('PopularRankService', () => {
  afterEach(() => {
    delete process.env.POPULAR_RANK_WINDOW_DAYS;
  });

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
    return {
      service,
      rankModel,
      logService,
      findOneQuery,
      findQuery,
    };
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

  it('reads only the latest batch with after, limit, and maxTimeMS', async () => {
    const latest = freshBatch();
    const { service, rankModel, logService, findOneQuery, findQuery } =
      createMocks({
        latestResults: [latest],
        docs: [
          {
            cakeId: 'cake-1',
            total: 9.9,
            image: { s3Url: 'cake.jpg' },
            owner_store_id: 'store-1',
            tag_ins: ['birthday'],
          },
        ],
      });

    const result = await service.getRanked(10, 4, 400);

    expect(logService.getRankCake).not.toHaveBeenCalled();
    expect(findOneQuery.maxTimeMS).toHaveBeenCalledWith(400);
    expect(rankModel.find).toHaveBeenCalledWith({
      computedAt: latest.computedAt,
      isEmptyBatch: { $ne: true },
      total: { $lt: 10 },
    });
    expect(findQuery.sort).toHaveBeenCalledWith({ rank: 1 });
    expect(findQuery.limit).toHaveBeenCalledWith(4);
    expect(findQuery.maxTimeMS).toHaveBeenCalledWith(400);
    expect(result.cakes).toEqual([
      {
        _id: 'cake-1',
        total: 9.9,
        image: { s3Url: 'cake.jpg' },
        owner_store_id: 'store-1',
        tag_ins: ['birthday'],
      },
    ]);
  });

  it('builds a ranked read-model batch synchronously on cold start', async () => {
    const built = freshBatch();
    const { service, rankModel, logService } = createMocks({
      latestResults: [null, built],
      docs: [
        {
          cakeId: 'cake-1',
          total: 2.9,
          image: {},
          owner_store_id: 'store-1',
          tag_ins: [],
        },
      ],
      rankCakes: [
        {
          _id: 'cake-1',
          total: 2.9,
          image: {},
          owner_store_id: 'store-1',
          tag_ins: [],
        },
      ],
    });

    await service.getRanked(NaN, 4);

    expect(logService.getRankCake).toHaveBeenCalledTimes(1);
    const [start, end, after, topN] = logService.getRankCake.mock.calls[0];
    expect(new Date(end).getTime() - new Date(start).getTime()).toBe(
      30 * DAY_MS,
    );
    expect(after).toBeNaN();
    expect(topN).toBe(100);
    expect(rankModel.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        rank: 1,
        cakeId: 'cake-1',
        total: 2.9,
        windowStart: expect.any(Date),
        windowEnd: expect.any(Date),
        computedAt: expect.any(Date),
      }),
    ]);
    expect(rankModel.deleteMany).toHaveBeenCalledWith({
      computedAt: { $lt: expect.any(Date) },
    });
  });

  it('serves stale data and triggers one background refresh', async () => {
    const stale = freshBatch({
      computedAt: new Date(Date.now() - 11 * 60 * 1000),
    });
    const { service, logService } = createMocks({
      latestResults: [stale],
      docs: [
        {
          cakeId: 'stale-cake',
          total: 1,
          image: {},
          owner_store_id: 'store-1',
          tag_ins: [],
        },
      ],
      rankCakes: [],
    });

    const result = await service.getRanked(NaN, 4);
    await new Promise(setImmediate);

    expect(result.cakes).toEqual([
      expect.objectContaining({ _id: 'stale-cake', total: 1 }),
    ]);
    expect(logService.getRankCake).toHaveBeenCalledTimes(1);
  });

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
