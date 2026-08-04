import { RankingQueryService } from './ranking-query.service';
import { rankingConfigFixture } from '../../test/support/typed-config.fixtures';

describe('RankingQueryService', () => {
  function createService(config: any = rankingConfigFixture) {
    const keywordRankService = {
      getRanked: jest.fn().mockResolvedValue({
        ranking: [{ _id: 'precomputed', count: 2 }],
        startDate: '2026-06-04',
        endDate: '2026-07-04',
      }),
    };
    const popularRankService = {
      getRanked: jest.fn().mockResolvedValue({
        cakes: [
          {
            _id: 'cake-1',
            image: {
              name: 'cake.png',
              converte_name: 'cake-converted.png',
              key: 'cakes/cake-converted.png',
              s3Url: 'https://cdn.example.com/cake.png',
            },
            owner_store_id: 'store-1',
            tag_ins: ['birthday'],
            total: 12.5,
          },
        ],
        startDate: '2026-06-04',
        endDate: '2026-07-04',
      }),
    };
    const keywordEventReader = {
      getRanked: jest.fn().mockResolvedValue([{ _id: 'realtime', count: 1 }]),
    };
    const service = new RankingQueryService(
      keywordRankService as never,
      popularRankService as never,
      keywordEventReader as never,
      config,
    );

    return {
      service,
      keywordRankService,
      popularRankService,
      keywordEventReader,
    };
  }

  it('serves the default keyword path from the read model', async () => {
    const { service, keywordRankService, keywordEventReader } = createService();

    await expect(
      service.getKeywordRank(undefined, undefined, 4, 400),
    ).resolves.toEqual({
      ranking: [{ id: 'precomputed', count: 2 }],
      startDate: '2026-06-04',
      endDate: '2026-07-04',
    });
    expect(keywordRankService.getRanked).toHaveBeenCalledWith(4, 400);
    expect(keywordEventReader.getRanked).not.toHaveBeenCalled();
  });

  it('keeps the source aggregation path for explicit keyword dates', async () => {
    const { service, keywordRankService, keywordEventReader } = createService();

    await expect(
      service.getKeywordRank('2024-01-01', '2024-02-01'),
    ).resolves.toEqual({
      ranking: [{ id: 'realtime', count: 1 }],
      startDate: '2024-01-01',
      endDate: '2024-02-01',
    });
    expect(keywordEventReader.getRanked).toHaveBeenCalledWith(
      '2024-01-01',
      '2024-02-01',
      undefined,
      undefined,
    );
    expect(keywordRankService.getRanked).not.toHaveBeenCalled();
  });

  it('maps popular read-model records to the public Cake view', async () => {
    const { service, popularRankService } = createService();

    const result = await service.getPopularCakes(12.5, 3, 50);

    expect(popularRankService.getRanked).toHaveBeenCalledWith(12.5, 3, 50);
    expect(result).toEqual({
      cakes: [
        expect.objectContaining({
          id: 'cake-1',
          ownerStoreId: 'store-1',
          tags: ['birthday'],
          calculatedLikes: 12.5,
          isDeleted: false,
        }),
      ],
      startDate: '2026-06-04',
      endDate: '2026-07-04',
    });
  });

  it('owns keyword and popular fallback window policy', () => {
    const { service } = createService({
      ...rankingConfigFixture,
      keywordWindowDays: 7,
      popularWindowDays: 14,
    });

    const keyword = service.getKeywordFallback();
    const popular = service.getPopularFallback();

    expect(keyword.ranking).toEqual([]);
    expect(popular.cakes).toEqual([]);
    expect(
      new Date(keyword.endDate).getTime() -
        new Date(keyword.startDate).getTime(),
    ).toBe(7 * 24 * 60 * 60 * 1000);
    expect(
      new Date(popular.endDate).getTime() -
        new Date(popular.startDate).getTime(),
    ).toBe(14 * 24 * 60 * 60 * 1000);
  });
});
