import { KeywordRankService } from './keyword-rank.service';
import { rankingConfigFixture } from '../../../test/support/typed-config.fixtures';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_STR = /^\d{4}-\d{2}-\d{2}$/;

describe('KeywordRankService', () => {
  function createMocks(options?: {
    latestResults?: unknown[];
    docs?: unknown[];
    rankWords?: unknown[];
    config?: any;
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
    const keywordEventReader = {
      getRanked: jest.fn().mockResolvedValue(options?.rankWords ?? []),
    };
    const service = new KeywordRankService(
      rankModel as never,
      keywordEventReader as never,
      options?.config ?? rankingConfigFixture,
    );
    return { service, rankModel, keywordEventReader, findQuery };
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
    const { service, rankModel, keywordEventReader, findQuery } = createMocks({
      latestResults: [latest],
      docs: [
        { searchWord: 'birthday', count: 10 },
        { searchWord: 'cream', count: 7 },
      ],
    });

    const result = await service.getRanked(4, 400);

    expect(keywordEventReader.getRanked).not.toHaveBeenCalled();
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
    const { service, rankModel, keywordEventReader } = createMocks({
      latestResults: [null, built],
      docs: [{ searchWord: 'cream', count: 5 }],
      rankWords: [{ _id: 'cream', count: 5 }],
    });

    const result = await service.getRanked(4);

    expect(keywordEventReader.getRanked).toHaveBeenCalledTimes(1);
    const [start, end, topN] = keywordEventReader.getRanked.mock.calls[0];
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

  it('applies the injected window days', async () => {
    const { service, keywordEventReader } = createMocks({
      latestResults: [null, null],
      config: { ...rankingConfigFixture, keywordWindowDays: 7 },
    });

    await service.getRanked(4);

    const [start, end] = keywordEventReader.getRanked.mock.calls[0];
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
    const { service, rankModel, keywordEventReader } = createMocks({
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
    expect(keywordEventReader.getRanked).toHaveBeenCalledTimes(1);
  });

  it('triggers a single background refresh for a stale batch', async () => {
    const stale = freshBatch({
      computedAt: new Date(Date.now() - 11 * 60 * 1000),
    });
    const { service, keywordEventReader } = createMocks({
      latestResults: [stale],
      docs: [{ searchWord: 'birthday', count: 10 }],
      rankWords: [{ _id: 'birthday', count: 12 }],
    });

    const result = await service.getRanked(4);
    await new Promise(setImmediate);

    expect(keywordEventReader.getRanked).toHaveBeenCalledTimes(1);
    expect(result.ranking).toEqual([{ _id: 'birthday', count: 10 }]);
  });

  it('keeps serving the previous batch when the refresh fails', async () => {
    const stale = freshBatch({
      computedAt: new Date(Date.now() - 11 * 60 * 1000),
    });
    const { service, keywordEventReader, rankModel } = createMocks({
      latestResults: [stale],
      docs: [{ searchWord: 'birthday', count: 10 }],
    });
    keywordEventReader.getRanked.mockRejectedValue(
      new Error('aggregate failed'),
    );

    const result = await service.getRanked(4);
    await new Promise(setImmediate);

    expect(result.ranking).toEqual([{ _id: 'birthday', count: 10 }]);
    expect(rankModel.insertMany).not.toHaveBeenCalled();
    expect(rankModel.deleteMany).not.toHaveBeenCalled();
  });
});
