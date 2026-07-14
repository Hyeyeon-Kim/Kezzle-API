import { ServiceUnavailableException } from '@nestjs/common';
import { HomeFeedService } from './home-feed.service';

describe('HomeFeedService', () => {
  afterEach(() => {
    delete process.env.HOME_HARD_DEADLINE_MS;
    delete process.env.HOME_RECOMMEND_TIMEOUT_MS;
  });

  const anniversary = {
    _id: 'anniversary-id',
    name: '기념일',
    dday: 'D-1',
    ment: '기념일 케이크',
    images: ['image'],
  };
  const popularCakes = {
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    cakes: [{ _id: 'popular-cake' }],
  };
  const keywordRanks = {
    startDate: '2023-01-01',
    endDate: '2023-11-25',
    ranking: [{ _id: '스마일', count: 10 }],
  };
  const newestCakes = {
    hasMore: false,
    cakes: [{ _id: 'newest-cake' }],
  };

  function createService(overrides?: {
    recommend?: jest.Mock;
    anniversary?: jest.Mock;
    popular?: jest.Mock;
    keywordRanks?: jest.Mock;
    newest?: jest.Mock;
  }) {
    const cakeService = {
      findRecommendationSeed: jest.fn().mockResolvedValue('seed-cake'),
      findAllByRecommend:
        overrides?.recommend ?? jest.fn().mockResolvedValue([]),
      popular: overrides?.popular ?? jest.fn().mockResolvedValue(popularCakes),
      findAllByNewest:
        overrides?.newest ?? jest.fn().mockResolvedValue(newestCakes),
    };
    const anniversaryService = {
      getAnniversary:
        overrides?.anniversary ?? jest.fn().mockResolvedValue(anniversary),
    };
    const searchService = {
      getRank:
        overrides?.keywordRanks ?? jest.fn().mockResolvedValue(keywordRanks),
    };
    const curationQuery = {
      findFeatured: jest.fn().mockResolvedValue([]),
    };
    const homeMetrics = {
      run: jest.fn((callback: () => Promise<unknown>) => callback()),
      timeSection: jest.fn((_name: string, callback: () => Promise<unknown>) =>
        callback(),
      ),
      countDb: jest.fn(),
      countAi: jest.fn(),
      countAiError: jest.fn(),
      flush: jest.fn(),
    };
    const homeCache = {
      getWithSwr: jest.fn(({ refresh }) => refresh()),
    };
    const monitoring = {
      observeHomeRequest: jest.fn(),
      countHomeDegraded: jest.fn(),
      observeHomeSection: jest.fn(),
    };

    const service = new HomeFeedService(
      cakeService as never,
      anniversaryService as never,
      searchService as never,
      curationQuery as never,
      homeMetrics as never,
      homeCache as never,
      monitoring as never,
    );

    return {
      service,
      cakeService,
      anniversaryService,
      searchService,
      curationQuery,
      homeMetrics,
      homeCache,
    };
  }

  it('keeps the current response fields and reports healthy sections', async () => {
    const { service } = createService();

    const response = await service.getHome({ cake_like_ids: [] } as never);

    expect(response).toMatchObject({
      anniversary,
      recommendCakes: [],
      popularCakes,
      keywordRanks,
      newestCakes,
      curations: [],
      degraded: false,
    });
    expect(response.sections.recommendCakes.status).toBe('success');
    expect(response.sections.anniversary.status).toBe('success');
    expect(response.sections.popularCakes.status).toBe('success');
    expect(response.sections.keywordRanks.status).toBe('success');
    expect(response.sections.newestCakes.status).toBe('success');
    expect(response.sections.curations.status).toBe('success');
  });

  it('returns a typed fallback when an optional section fails', async () => {
    const { service } = createService({
      anniversary: jest.fn().mockRejectedValue(new Error('CLIP unavailable')),
    });

    const response = await service.getHome({ cake_like_ids: [] } as never);

    expect(response.degraded).toBe(true);
    expect(response.anniversary).toEqual({
      _id: '',
      name: '',
      dday: '',
      ment: '',
      images: [],
    });
    expect(response.sections.anniversary).toMatchObject({
      status: 'fallback',
      reason: 'dependency_error',
    });
  });

  it('fails with 503 only when all core sections fail', async () => {
    const { service, homeMetrics } = createService({
      recommend: jest.fn().mockRejectedValue(new Error('VIT unavailable')),
      popular: jest.fn().mockRejectedValue(new Error('Mongo unavailable')),
      newest: jest.fn().mockRejectedValue(new Error('Mongo unavailable')),
    });

    await expect(
      service.getHome({ cake_like_ids: [] } as never),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(homeMetrics.flush).toHaveBeenCalledWith('error');
  });

  it('responds at the hard deadline and aborts unfinished sections', async () => {
    process.env.HOME_HARD_DEADLINE_MS = '80';
    process.env.HOME_RECOMMEND_TIMEOUT_MS = '5000';
    let recommendSignal: AbortSignal | undefined;
    const { service } = createService({
      recommend: jest.fn((_seed: string, signal: AbortSignal) => {
        recommendSignal = signal;
        return new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            reject(new Error('dependency aborted'));
          });
        });
      }),
    });

    const response = await service.getHome({ cake_like_ids: [] } as never);

    expect(response.degraded).toBe(true);
    expect(response.sections.recommendCakes).toMatchObject({
      status: 'fallback',
      reason: 'timeout',
    });
    expect(recommendSignal?.aborted).toBe(true);
  });

  it('passes timeout budgets through narrow feature query surfaces', async () => {
    const {
      service,
      cakeService,
      anniversaryService,
      searchService,
      curationQuery,
    } = createService();

    await service.getHome({ cake_like_ids: [] } as never);

    expect(cakeService.findRecommendationSeed).toHaveBeenCalledWith(
      expect.anything(),
      250,
    );
    expect(anniversaryService.getAnniversary).toHaveBeenCalledWith(
      expect.any(AbortSignal),
      250,
    );
    expect(cakeService.popular).toHaveBeenCalledWith(NaN, 3, 50);
    expect(searchService.getRank).toHaveBeenCalledWith(
      undefined,
      undefined,
      4,
      400,
    );
    expect(cakeService.findAllByNewest).toHaveBeenCalledWith(undefined, 4, 100);
    expect(curationQuery.findFeatured).toHaveBeenCalledWith(4, 100);
  });

  it('owns all Home cache keys', async () => {
    const { service, homeCache } = createService();

    await service.getHome({ cake_like_ids: [] } as never);

    const keys = homeCache.getWithSwr.mock.calls.map(
      ([options]) => options.key,
    );
    expect(keys).toEqual(
      expect.arrayContaining([
        'home:similar:seed-cake',
        'home:anniversary',
        'home:popular',
        'home:keyword-ranks',
        'home:newest:4',
        'home:curations',
      ]),
    );
  });

  it('maps curation query results without triggering a refresh', async () => {
    const { service, curationQuery } = createService();
    curationQuery.findFeatured.mockResolvedValue([
      {
        _id: 'curation-1',
        key: 'fixture curation',
        cakes: [],
        updatedAt: new Date('2020-01-01T00:00:00.000Z'),
      },
    ]);

    const response = await service.getHome({ cake_like_ids: [] } as never);

    expect(response.curations).toEqual([
      { _id: 'curation-1', cakes: [], description: 'fixture curation' },
    ]);
    expect(curationQuery.findFeatured).toHaveBeenCalledTimes(1);
  });
});
