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
    netCounts?: Array<{ cakeId: string; appLike: number }>;
    cakes?: Array<Record<string, unknown>>;
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
    const cakeLikeEventReader = {
      getNetCounts: jest.fn().mockResolvedValue(options?.netCounts ?? []),
    };
    const cakeRankingReader = {
      findByIds: jest.fn().mockResolvedValue(options?.cakes ?? []),
    };
    const service = new PopularRankService(
      rankModel as never,
      cakeLikeEventReader as never,
      cakeRankingReader as never,
    );
    return {
      service,
      rankModel,
      cakeLikeEventReader,
      cakeRankingReader,
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
    const {
      service,
      rankModel,
      cakeLikeEventReader,
      cakeRankingReader,
      findOneQuery,
      findQuery,
    } = createMocks({
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

    expect(cakeLikeEventReader.getNetCounts).not.toHaveBeenCalled();
    expect(cakeRankingReader.findByIds).not.toHaveBeenCalled();
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

  it('builds one ranked batch with the legacy score and Cake ID tie-break', async () => {
    const built = freshBatch();
    const { service, rankModel, cakeLikeEventReader, cakeRankingReader } =
      createMocks({
        latestResults: [null, built],
        netCounts: [
          { cakeId: 'cake-b', appLike: 1 },
          { cakeId: 'cake-high', appLike: 0 },
          { cakeId: 'cake-a', appLike: 1 },
        ],
        cakes: [
          {
            id: 'cake-b',
            likeText: '10',
            image: {},
            ownerStoreId: 'store-1',
            tags: [],
          },
          {
            id: 'cake-high',
            likeText: '20',
            image: {},
            ownerStoreId: 'store-1',
            tags: [],
          },
          {
            id: 'cake-a',
            likeText: '10',
            image: {},
            ownerStoreId: 'store-1',
            tags: [],
          },
        ],
        docs: [],
      });

    await service.getRanked(NaN, 4);

    expect(cakeLikeEventReader.getNetCounts).toHaveBeenCalledTimes(1);
    const [start, end] = cakeLikeEventReader.getNetCounts.mock.calls[0];
    expect(new Date(end).getTime() - new Date(start).getTime()).toBe(
      30 * DAY_MS,
    );
    expect(cakeRankingReader.findByIds).toHaveBeenCalledTimes(1);
    expect(cakeRankingReader.findByIds).toHaveBeenCalledWith([
      'cake-b',
      'cake-high',
      'cake-a',
    ]);
    expect(rankModel.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ rank: 1, cakeId: 'cake-high', total: 4 }),
      expect.objectContaining({ rank: 2, cakeId: 'cake-a', total: 2.9 }),
      expect.objectContaining({ rank: 3, cakeId: 'cake-b', total: 2.9 }),
    ]);
    expect(rankModel.deleteMany).toHaveBeenCalledWith({
      computedAt: { $lt: expect.any(Date) },
    });
  });

  it('serves stale data and triggers one two-step background refresh', async () => {
    const stale = freshBatch({
      computedAt: new Date(Date.now() - 11 * 60 * 1000),
    });
    const { service, cakeLikeEventReader, cakeRankingReader } = createMocks({
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
      netCounts: [{ cakeId: 'cake-1', appLike: 1 }],
      cakes: [
        {
          id: 'cake-1',
          likeText: '10',
          image: {},
          ownerStoreId: 'store-1',
          tags: [],
        },
      ],
    });

    const result = await service.getRanked(NaN, 4);
    await new Promise(setImmediate);

    expect(result.cakes).toEqual([
      expect.objectContaining({ _id: 'stale-cake', total: 1 }),
    ]);
    expect(cakeLikeEventReader.getNetCounts).toHaveBeenCalledTimes(1);
    expect(cakeRankingReader.findByIds).toHaveBeenCalledTimes(1);
  });

  it('serves an empty latest batch without aggregation or a refresh loop', async () => {
    const latest = freshBatch({ isEmptyBatch: true });
    const {
      service,
      rankModel,
      cakeLikeEventReader,
      cakeRankingReader,
      findQuery,
    } = createMocks({ latestResults: [latest] });

    const result = await service.getRanked(NaN, 10, 400);

    expect(cakeLikeEventReader.getNetCounts).not.toHaveBeenCalled();
    expect(cakeRankingReader.findByIds).not.toHaveBeenCalled();
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

  it('writes an empty marker without issuing a Cake query', async () => {
    const { service, rankModel, cakeLikeEventReader, cakeRankingReader } =
      createMocks({ netCounts: [] });

    await service.refresh();

    expect(cakeLikeEventReader.getNetCounts).toHaveBeenCalledTimes(1);
    expect(cakeRankingReader.findByIds).not.toHaveBeenCalled();
    expect(rankModel.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        windowStart: expect.any(Date),
        windowEnd: expect.any(Date),
        computedAt: expect.any(Date),
        isEmptyBatch: true,
      }),
    ]);
  });
});
