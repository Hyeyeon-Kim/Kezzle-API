import { PopularRankService } from './popular-rank.service';
import { rankingConfigFixture } from '../../test/support/typed-config.fixtures';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_STR = /^\d{4}-\d{2}-\d{2}$/;

describe('PopularRankService', () => {
  function createMocks(options?: {
    latestResults?: unknown[];
    docs?: unknown[];
    candidates?: Array<Record<string, unknown>>;
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
    const sourceReader = {
      findTop: jest.fn().mockResolvedValue(options?.candidates ?? []),
    };
    const service = new PopularRankService(
      rankModel as never,
      sourceReader as never,
      options?.config ?? rankingConfigFixture,
    );
    return {
      service,
      rankModel,
      sourceReader,
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
    const { service, rankModel, sourceReader, findOneQuery, findQuery } =
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

    expect(sourceReader.findTop).not.toHaveBeenCalled();
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

  it('builds one pagination batch from the bounded source reader order', async () => {
    const built = freshBatch();
    const { service, rankModel, sourceReader } = createMocks({
      latestResults: [null, built],
      candidates: [
        {
          cakeId: 'cake-high',
          total: 4,
          image: {},
          ownerStoreId: 'store-1',
          tags: [],
        },
        {
          cakeId: 'cake-a',
          total: 2.9,
          image: {},
          ownerStoreId: 'store-1',
          tags: [],
        },
        {
          cakeId: 'cake-b',
          total: 2.9,
          image: {},
          ownerStoreId: 'store-1',
          tags: [],
        },
      ],
      docs: [],
    });

    await service.getRanked(NaN, 4);

    expect(sourceReader.findTop).toHaveBeenCalledTimes(1);
    const query = sourceReader.findTop.mock.calls[0][0];
    expect(query.end.getTime() - query.start.getTime()).toBe(30 * DAY_MS);
    expect(query).toMatchObject({ limit: 1000, maxTimeMs: 5000 });
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
    const { service, sourceReader } = createMocks({
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
      candidates: [
        {
          cakeId: 'cake-1',
          total: 2.9,
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
    expect(sourceReader.findTop).toHaveBeenCalledTimes(1);
  });

  it('serves an empty latest batch without aggregation or a refresh loop', async () => {
    const latest = freshBatch({ isEmptyBatch: true });
    const { service, rankModel, sourceReader, findQuery } = createMocks({
      latestResults: [latest],
    });

    const result = await service.getRanked(NaN, 10, 400);

    expect(sourceReader.findTop).not.toHaveBeenCalled();
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
    const { service, rankModel, sourceReader } = createMocks({
      candidates: [],
    });

    await service.refresh();

    expect(sourceReader.findTop).toHaveBeenCalledTimes(1);
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
