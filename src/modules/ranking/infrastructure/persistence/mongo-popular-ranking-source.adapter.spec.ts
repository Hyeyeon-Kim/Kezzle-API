import { MongoPopularRankingSourceAdapter } from './mongo-popular-ranking-source.adapter';

describe('MongoPopularRankingSourceAdapter', () => {
  function createAdapter(rows: unknown[] = []) {
    const toArray = jest.fn().mockResolvedValue(rows);
    const aggregate = jest.fn().mockReturnValue({ toArray });
    const collection = jest.fn().mockReturnValue({ aggregate });
    const adapter = new MongoPopularRankingSourceAdapter({
      collection,
    } as never);
    return { adapter, collection, aggregate, toArray };
  }

  it('scores, sorts, and limits candidates inside Mongo with a finite legacy score fallback', async () => {
    const { adapter, collection, aggregate } = createAdapter([
      {
        _id: 'cake-1',
        total: 2.9,
        image: {
          name: 'cake.png',
          converte_name: 'converted.png',
          key: 'store-1/cakes/converted.png',
          s3Url: 'https://cdn.example.com/converted.png',
        },
        owner_store_id: 'store-1',
        tag_ins: ['birthday'],
      },
    ]);
    const start = new Date('2026-07-01T00:00:00.000Z');
    const end = new Date('2026-08-01T00:00:00.000Z');

    await expect(
      adapter.findTop({ start, end, limit: 100, maxTimeMs: 4000 }),
    ).resolves.toEqual([
      {
        cakeId: 'cake-1',
        total: 2.9,
        image: {
          name: 'cake.png',
          converteName: 'converted.png',
          key: 'store-1/cakes/converted.png',
          s3Url: 'https://cdn.example.com/converted.png',
        },
        ownerStoreId: 'store-1',
        tags: ['birthday'],
      },
    ]);
    expect(collection).toHaveBeenCalledWith('cakelikelogs');

    const [pipeline, options] = aggregate.mock.calls[0];
    expect(pipeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          $lookup: expect.objectContaining({
            from: 'cakes',
            localField: '_id',
            foreignField: '_id',
          }),
        }),
        {
          $project: {
            _id: 1,
            app_like: 1,
            image: '$cake.image',
            owner_store_id: '$cake.owner_store_id',
            like_ins: '$cake.like_ins',
            tag_ins: { $ifNull: ['$cake.tag_ins', []] },
          },
        },
        {
          $set: {
            legacy_like_score: {
              $convert: {
                input: '$like_ins',
                to: 'double',
                onError: 0,
                onNull: 0,
              },
            },
          },
        },
        {
          $set: {
            total: {
              $add: [
                {
                  $multiply: [
                    {
                      $cond: [
                        {
                          $and: [
                            {
                              $gte: ['$legacy_like_score', -Number.MAX_VALUE],
                            },
                            {
                              $lte: ['$legacy_like_score', Number.MAX_VALUE],
                            },
                          ],
                        },
                        '$legacy_like_score',
                        0,
                      ],
                    },
                    0.2,
                  ],
                },
                { $multiply: ['$app_like', 0.9] },
              ],
            },
          },
        },
        { $sort: { total: -1, _id: 1 } },
        { $limit: 100 },
      ]),
    );
    expect(options).toEqual({ maxTimeMS: 4000 });
  });

  it('defensively maps a non-finite Mongo result to zero', async () => {
    const { adapter } = createAdapter([
      {
        _id: 'cake-invalid',
        total: Number.NaN,
        owner_store_id: 'store-1',
        tag_ins: [],
      },
    ]);

    await expect(
      adapter.findTop({
        start: new Date('2026-07-01T00:00:00.000Z'),
        end: new Date('2026-08-01T00:00:00.000Z'),
        limit: 100,
        maxTimeMs: 4000,
      }),
    ).resolves.toEqual([
      expect.objectContaining({ cakeId: 'cake-invalid', total: 0 }),
    ]);
  });
});
