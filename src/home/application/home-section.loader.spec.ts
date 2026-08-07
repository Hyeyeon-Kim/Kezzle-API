import { HomeSectionLoader } from './home-section.loader';

describe('HomeSectionLoader', () => {
  const anniversary = {
    id: 'anniversary-id',
    name: '기념일',
    dday: 'D-1',
    mention: '기념일 케이크',
    images: ['image'],
  };
  const popularCakes = {
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    cakes: [{ id: 'popular-cake' }],
  };
  const keywordRanks = {
    startDate: '2023-01-01',
    endDate: '2023-11-25',
    ranking: [{ id: '스마일', count: 10 }],
  };
  const newestCakes = {
    hasMore: false,
    cakes: [{ id: 'newest-cake' }],
  };

  function createLoader(overrides?: {
    seed?: jest.Mock;
    recommend?: jest.Mock;
    anniversaryQuery?: jest.Mock;
    anniversaryRecommendations?: jest.Mock;
    popular?: jest.Mock;
    keywordRanks?: jest.Mock;
    newest?: jest.Mock;
    curations?: jest.Mock;
  }) {
    const cakeQuery = {
      findRecommendationSeed:
        overrides?.seed ?? jest.fn().mockResolvedValue('seed-cake'),
      findAllByRecommend:
        overrides?.recommend ?? jest.fn().mockResolvedValue([]),
      findAllByNewest:
        overrides?.newest ?? jest.fn().mockResolvedValue(newestCakes),
    };
    const anniversarySource = {
      id: 'anniversary-id',
      name: '기념일',
      ment: '기념일 케이크',
      keyword: ['기념일'],
      date: new Date(),
    };
    const anniversaryService = {
      findNextAnniversary:
        overrides?.anniversaryQuery ??
        jest.fn().mockResolvedValue(anniversarySource),
      getAnniversaryRecommendations:
        overrides?.anniversaryRecommendations ??
        jest.fn().mockResolvedValue(anniversary),
    };
    const rankingQuery = {
      getPopularCakes:
        overrides?.popular ?? jest.fn().mockResolvedValue(popularCakes),
      getKeywordRank:
        overrides?.keywordRanks ?? jest.fn().mockResolvedValue(keywordRanks),
      getPopularFallback: jest.fn().mockReturnValue({
        cakes: [],
        startDate: '2023-01-01',
        endDate: '2023-12-31',
      }),
      getKeywordFallback: jest.fn().mockReturnValue({
        ranking: [],
        startDate: '2023-01-01',
        endDate: '2023-11-25',
      }),
    };
    const curationQuery = {
      findFeatured:
        overrides?.curations ?? jest.fn().mockResolvedValue([]),
    };
    const homeCache = {
      getWithSwr: jest.fn(({ refresh }) => refresh()),
      healthStatus: jest.fn(),
    };
    const homeMetrics = {
      countDb: jest.fn(),
      countAi: jest.fn(),
      countAiError: jest.fn(),
    };
    const loader = new HomeSectionLoader(
      cakeQuery as never,
      anniversaryService as never,
      rankingQuery as never,
      curationQuery as never,
      homeCache as never,
      homeMetrics as never,
    );

    return {
      loader,
      cakeQuery,
      anniversaryService,
      rankingQuery,
      curationQuery,
      homeCache,
      homeMetrics,
    };
  }

  it('loads every section with the existing timeout and query contract', async () => {
    const {
      loader,
      cakeQuery,
      anniversaryService,
      rankingQuery,
      curationQuery,
      homeCache,
      homeMetrics,
    } = createLoader();
    const signal = new AbortController().signal;
    const user = { cake_like_ids: [] } as never;

    await Promise.all([
      loader.loadRecommendCakes(user, 250, signal),
      loader.loadAnniversary(250, signal),
      loader.loadPopularCakes(50),
      loader.loadKeywordRanks(400),
      loader.loadNewestCakes(100),
      loader.loadCurations(100),
    ]);

    expect(cakeQuery.findRecommendationSeed).toHaveBeenCalledWith(user, 250);
    expect(cakeQuery.findAllByRecommend).toHaveBeenCalledWith(
      'seed-cake',
      signal,
    );
    expect(anniversaryService.findNextAnniversary).toHaveBeenCalledWith(250);
    expect(
      anniversaryService.getAnniversaryRecommendations,
    ).toHaveBeenCalledWith(expect.objectContaining({ id: 'anniversary-id' }), signal);
    expect(rankingQuery.getPopularCakes).toHaveBeenCalledWith(NaN, 3, 50);
    expect(rankingQuery.getKeywordRank).toHaveBeenCalledWith(
      undefined,
      undefined,
      4,
      400,
    );
    expect(cakeQuery.findAllByNewest).toHaveBeenCalledWith(undefined, 4, 100);
    expect(curationQuery.findFeatured).toHaveBeenCalledWith(4, 100);
    expect(homeMetrics.countDb.mock.calls).toEqual(
      expect.arrayContaining([[], [2], [2]]),
    );
    expect(homeCache.getWithSwr.mock.calls.map(([request]) => request)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keySuffix: 'similar:seed-cake',
          policy: 'recommend',
        }),
        expect.objectContaining({
          keySuffix: 'anniversary',
          policy: 'anniversary',
        }),
        expect.objectContaining({ keySuffix: 'popular', policy: 'popular' }),
        expect.objectContaining({
          keySuffix: 'keyword-ranks',
          policy: 'keywordRanks',
        }),
        expect.objectContaining({ keySuffix: 'newest:4', policy: 'newest' }),
        expect.objectContaining({ keySuffix: 'curations', policy: 'curations' }),
      ]),
    );
  });

  it('skips recommendation cache and VIT when no seed cake exists', async () => {
    const { loader, cakeQuery, homeCache, homeMetrics } = createLoader({
      seed: jest.fn().mockResolvedValue(null),
    });

    await expect(
      loader.loadRecommendCakes(
        { cake_like_ids: [] } as never,
        250,
        new AbortController().signal,
      ),
    ).resolves.toEqual([]);

    expect(cakeQuery.findAllByRecommend).not.toHaveBeenCalled();
    expect(homeCache.getWithSwr).not.toHaveBeenCalled();
    expect(homeMetrics.countAi).not.toHaveBeenCalledWith('vit');
  });

  it('counts only an actual CLIP call failure as an AI error', async () => {
    const databaseFailure = createLoader({
      anniversaryQuery: jest
        .fn()
        .mockRejectedValue(new Error('Mongo unavailable')),
    });

    await expect(
      databaseFailure.loader.loadAnniversary(
        250,
        new AbortController().signal,
      ),
    ).rejects.toThrow('Mongo unavailable');
    expect(databaseFailure.homeMetrics.countAiError).not.toHaveBeenCalled();

    const clipFailure = createLoader({
      anniversaryRecommendations: jest
        .fn()
        .mockRejectedValue(new Error('CLIP unavailable')),
    });
    await expect(
      clipFailure.loader.loadAnniversary(
        250,
        new AbortController().signal,
      ),
    ).rejects.toThrow('CLIP unavailable');
    expect(clipFailure.homeMetrics.countAi).toHaveBeenCalledWith('clip');
    expect(clipFailure.homeMetrics.countAiError).toHaveBeenCalledWith('clip');
  });

  it('computes ranking fallbacks for each Home request', () => {
    const { loader, rankingQuery } = createLoader();

    loader.getFallbacks();
    loader.getFallbacks();

    expect(rankingQuery.getPopularFallback).toHaveBeenCalledTimes(2);
    expect(rankingQuery.getKeywordFallback).toHaveBeenCalledTimes(2);
  });
});
