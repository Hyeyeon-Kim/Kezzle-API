import { MongoKeywordRankingSourceAdapter } from './mongo-keyword-ranking-source.adapter';

describe('MongoKeywordRankingSourceAdapter', () => {
  function createAdapter(rows: unknown[] = []) {
    const toArray = jest.fn().mockResolvedValue(rows);
    const aggregate = jest.fn().mockReturnValue({ toArray });
    const collection = jest.fn().mockReturnValue({ aggregate });
    const adapter = new MongoKeywordRankingSourceAdapter({
      collection,
    } as never);

    return { adapter, collection, aggregate, toArray };
  }

  it('keeps the custom date window, stable count sort, limit, and maxTimeMS in Mongo', async () => {
    const { adapter, collection, aggregate } = createAdapter([
      { _id: 'birthday', count: 3 },
    ]);

    await expect(
      adapter.getRanked('2026-01-01', '2026-01-31', 4, 400),
    ).resolves.toEqual([{ _id: 'birthday', count: 3 }]);

    expect(collection).toHaveBeenCalledWith('keywordlogs');
    expect(aggregate).toHaveBeenCalledWith(
      [
        {
          $match: {
            createdAt: {
              $gte: new Date('2026-01-01'),
              $lte: new Date('2026-01-31'),
            },
          },
        },
        { $group: { _id: '$searchWord', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 4 },
      ],
      { maxTimeMS: 400 },
    );
  });

  it('keeps the legacy default limit and omits maxTimeMS when absent', async () => {
    const { adapter, aggregate } = createAdapter();

    await adapter.getRanked('2026-01-01', '2026-01-31');

    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(aggregate.mock.calls[0]).toHaveLength(1);
    expect(aggregate.mock.calls[0][0]).toContainEqual({ $limit: 10 });
  });
});
