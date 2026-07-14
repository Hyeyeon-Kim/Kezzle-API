import { KeywordRankService } from './keyword-rank.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_STR = /^\d{4}-\d{2}-\d{2}$/;

describe('KeywordRankService', () => {
  afterEach(() => {
    delete process.env.KEYWORD_RANK_WINDOW_DAYS;
  });

  function createMocks(options?: {
    latestResults?: unknown[];
    docs?: unknown[];
    rankWords?: unknown[];
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
      getRankWord: jest.fn().mockResolvedValue(options?.rankWords ?? []),
    };
    const homeMetrics = {
      countDb: jest.fn(),
      countBackgroundRefresh: jest.fn(),
    };
    const service = new KeywordRankService(
      rankModel as never,
      logService as never,
      homeMetrics as never,
    );
    return { service, rankModel, logService, homeMetrics, findQuery };
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

  it('reads only the latest batch without running the aggregation', async () => {
    const latest = freshBatch();
    const { service, rankModel, logService, findQuery } = createMocks({
      latestResults: [latest],
      docs: [
        { searchWord: 'birthday', count: 10 },
        { searchWord: 'cream', count: 7 },
      ],
    });

    const result = await service.getRanked(4, 400);

    expect(logService.getRankWord).not.toHaveBeenCalled();
    expect(rankModel.find).toHaveBeenCalledWith({
      computedAt: latest.computedAt,
      isEmptyBatch: { $ne: true },
    });
    expect(findQuery.limit).toHaveBeenCalledWith(4);
    expect(findQuery.maxTimeMS).toHaveBeenCalledWith(400);
    expect(result.ranking).toEqual([
      { _id: 'birthday', count: 10 },
      { _id: 'cream', count: 7 },
    ]);
    expect(result.startDate).toMatch(DATE_STR);
    expect(result.endDate).toMatch(DATE_STR);
  });

  it('builds the read model synchronously on cold start', async () => {
    const built = freshBatch();
    const { service, rankModel, logService } = createMocks({
      latestResults: [null, built],
      docs: [{ searchWord: 'cream', count: 5 }],
      rankWords: [{ _id: 'cream', count: 5 }],
    });

    const result = await service.getRanked(4);

    expect(logService.getRankWord).toHaveBeenCalledTimes(1);
    const [start, end, topN] = logService.getRankWord.mock.calls[0];
    expect(new Date(end).getTime() - new Date(start).getTime()).toBe(
      30 * DAY_MS,
    );
    expect(topN).toBe(20);
    expect(rankModel.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        rank: 1,
        searchWord: 'cream',
        count: 5,
        windowStart: expect.any(Date),
        windowEnd: expect.any(Date),
      }),
    ]);
    expect(rankModel.deleteMany).toHaveBeenCalledWith({
      computedAt: { $lt: expect.any(Date) },
    });
    expect(result.ranking).toEqual([{ _id: 'cream', count: 5 }]);
  });

  it('applies the window days env override', async () => {
    process.env.KEYWORD_RANK_WINDOW_DAYS = '7';
    const { service, logService } = createMocks({
      latestResults: [null, null],
    });

    await service.getRanked(4);

    const [start, end] = logService.getRankWord.mock.calls[0];
    expect(new Date(end).getTime() - new Date(start).getTime()).toBe(
      7 * DAY_MS,
    );
  });

  it('returns an empty ranking when the window has no logs', async () => {
    const { service, rankModel } = createMocks({
      latestResults: [null, null],
      rankWords: [],
    });

    const result = await service.getRanked(4);

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
    expect(result.ranking).toEqual([]);
    expect(result.startDate).toMatch(DATE_STR);
    expect(result.endDate).toMatch(DATE_STR);
  });

  it('replaces an older batch with an empty batch marker', async () => {
    const emptyBatch = freshBatch({ isEmptyBatch: true });
    const { service, rankModel, logService, homeMetrics } = createMocks({
      latestResults: [emptyBatch],
      rankWords: [],
    });

    await service.refresh();
    const result = await service.getRanked(4);

    expect(rankModel.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ isEmptyBatch: true }),
    ]);
    expect(rankModel.deleteMany).toHaveBeenCalledWith({
      computedAt: { $lt: expect.any(Date) },
    });
    expect(rankModel.find).toHaveBeenCalledWith({
      computedAt: emptyBatch.computedAt,
      isEmptyBatch: { $ne: true },
    });
    expect(result.ranking).toEqual([]);
    expect(logService.getRankWord).toHaveBeenCalledTimes(1);
    expect(homeMetrics.countBackgroundRefresh).not.toHaveBeenCalled();
  });

  it('triggers a single background refresh for a stale batch', async () => {
    const stale = freshBatch({
      computedAt: new Date(Date.now() - 11 * 60 * 1000),
    });
    const { service, logService, homeMetrics } = createMocks({
      latestResults: [stale],
      docs: [{ searchWord: 'birthday', count: 10 }],
      rankWords: [{ _id: 'birthday', count: 12 }],
    });

    const result = await service.getRanked(4);
    await new Promise(setImmediate);

    expect(homeMetrics.countBackgroundRefresh).toHaveBeenCalledTimes(1);
    expect(logService.getRankWord).toHaveBeenCalledTimes(1);
    expect(result.ranking).toEqual([{ _id: 'birthday', count: 10 }]);
  });

  it('keeps serving the previous batch when the refresh fails', async () => {
    const stale = freshBatch({
      computedAt: new Date(Date.now() - 11 * 60 * 1000),
    });
    const { service, logService, rankModel } = createMocks({
      latestResults: [stale],
      docs: [{ searchWord: 'birthday', count: 10 }],
    });
    logService.getRankWord.mockRejectedValue(new Error('aggregate failed'));

    const result = await service.getRanked(4);
    await new Promise(setImmediate);

    expect(result.ranking).toEqual([{ _id: 'birthday', count: 10 }]);
    expect(rankModel.insertMany).not.toHaveBeenCalled();
    expect(rankModel.deleteMany).not.toHaveBeenCalled();
  });
});
