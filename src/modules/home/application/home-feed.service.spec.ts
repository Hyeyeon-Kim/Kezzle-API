import { ServiceUnavailableException } from '@nestjs/common';
import { HomeFeedService } from './home-feed.service';
import { HomePresenter } from '../api/home.presenter';
import fixtures from '../../../../test/fixtures/type-boundary-read.contract.json';
import { homeConfigFixture } from '../../../../test/support/typed-config.fixtures';

function normalizeSectionDurations(response: unknown) {
  const normalized = JSON.parse(JSON.stringify(response));
  for (const section of Object.values(normalized.sections) as Array<{
    durationMs: number;
  }>) {
    section.durationMs = 0;
  }
  return normalized;
}

describe('HomeFeedService', () => {
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

  function createService(overrides?: {
    recommend?: jest.Mock;
    anniversaryQuery?: jest.Mock;
    anniversaryRecommendations?: jest.Mock;
    popular?: jest.Mock;
    keywordRanks?: jest.Mock;
    newest?: jest.Mock;
    config?: any;
  }) {
    const cakeService = {
      findRecommendationSeed: jest.fn().mockResolvedValue('seed-cake'),
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
      observeRequest: jest.fn(),
      observeSection: jest.fn(),
      countDegraded: jest.fn(),
      flush: jest.fn(),
    };
    const homeCache = {
      getWithSwr: jest.fn(({ refresh }) => refresh()),
    };
    const service = new HomeFeedService(
      cakeService as never,
      anniversaryService as never,
      rankingQuery as never,
      curationQuery as never,
      homeMetrics as never,
      homeCache as never,
      overrides?.config ?? homeConfigFixture,
    );

    return {
      service,
      cakeService,
      anniversaryService,
      rankingQuery,
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
    const { service, homeMetrics } = createService({
      anniversaryRecommendations: jest
        .fn()
        .mockRejectedValue(new Error('CLIP unavailable')),
    });

    const response = await service.getHome({ cake_like_ids: [] } as never);

    expect(response.degraded).toBe(true);
    expect(response.anniversary).toEqual({
      id: '',
      name: '',
      dday: '',
      mention: '',
      images: [],
    });
    expect(response.sections.anniversary).toMatchObject({
      status: 'fallback',
      reason: 'dependency_error',
    });
    expect(homeMetrics.countAi).toHaveBeenCalledWith('clip');
    expect(homeMetrics.countAiError).toHaveBeenCalledWith('clip');
  });

  it('does not count Mongo or missing-data failures as CLIP errors', async () => {
    const { service, homeMetrics, anniversaryService } = createService({
      anniversaryQuery: jest
        .fn()
        .mockRejectedValue(new Error('Mongo unavailable')),
    });

    const response = await service.getHome({ cake_like_ids: [] } as never);

    expect(response.sections.anniversary).toMatchObject({
      status: 'fallback',
      reason: 'dependency_error',
    });
    expect(
      anniversaryService.getAnniversaryRecommendations,
    ).not.toHaveBeenCalled();
    expect(homeMetrics.countAi).not.toHaveBeenCalledWith('clip');
    expect(homeMetrics.countAiError).not.toHaveBeenCalledWith('clip');
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
    let recommendSignal: AbortSignal | undefined;
    const { service } = createService({
      config: {
        ...homeConfigFixture,
        hardDeadlineMs: 80,
        sectionTimeoutMs: {
          ...homeConfigFixture.sectionTimeoutMs,
          recommendCakes: 5000,
        },
      },
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
      rankingQuery,
      curationQuery,
    } = createService();

    await service.getHome({ cake_like_ids: [] } as never);

    expect(cakeService.findRecommendationSeed).toHaveBeenCalledWith(
      expect.anything(),
      250,
    );
    expect(anniversaryService.findNextAnniversary).toHaveBeenCalledWith(250);
    expect(
      anniversaryService.getAnniversaryRecommendations,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'anniversary-id' }),
      expect.any(AbortSignal),
    );
    expect(rankingQuery.getPopularCakes).toHaveBeenCalledWith(NaN, 3, 50);
    expect(rankingQuery.getKeywordRank).toHaveBeenCalledWith(
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
        'home:v2:similar:seed-cake',
        'home:v2:anniversary',
        'home:v2:popular',
        'home:v2:keyword-ranks',
        'home:v2:newest:4',
        'home:v2:curations',
      ]),
    );
    expect(keys.some((key) => /^home:(?!v2:)/.test(key))).toBe(false);
  });

  it('skips recommendation cache and VIT when no seed cake exists', async () => {
    const { service, cakeService, homeCache } = createService();
    cakeService.findRecommendationSeed.mockResolvedValueOnce(null);

    const response = await service.getHome({ cake_like_ids: [] } as never);

    expect(response.recommendCakes).toEqual([]);
    expect(response.sections.recommendCakes.status).toBe('success');
    expect(cakeService.findAllByRecommend).not.toHaveBeenCalled();
    expect(
      homeCache.getWithSwr.mock.calls.some(([options]) =>
        options.key.startsWith('home:v2:similar:'),
      ),
    ).toBe(false);
  });

  it('maps curation query results without triggering a refresh', async () => {
    const { service, curationQuery } = createService();
    curationQuery.findFeatured.mockResolvedValue([
      {
        id: 'curation-1',
        key: 'fixture curation',
        cakes: [],
        updatedAt: new Date('2020-01-01T00:00:00.000Z'),
      },
    ]);

    const response = await service.getHome({ cake_like_ids: [] } as never);

    expect(response.curations).toEqual([
      expect.objectContaining({
        id: 'curation-1',
        cakes: [],
        key: 'fixture curation',
      }),
    ]);
    expect(curationQuery.findFeatured).toHaveBeenCalledTimes(1);
  });

  it('keeps the fixture-backed Home cache-hit value shape', async () => {
    const { service, homeCache } = createService();
    const cacheValues = fixtures.homeCacheValues as Record<string, unknown>;
    homeCache.getWithSwr.mockImplementation(({ key }) =>
      Promise.resolve(cacheValues[key]),
    );

    const view = await service.getHome({ cake_like_ids: [] } as never);
    const response = new HomePresenter().response(view);

    expect(normalizeSectionDurations(response)).toEqual(fixtures.home);
    expect(homeCache.getWithSwr).toHaveBeenCalledTimes(6);
  });

  it('keeps the fixture-backed Home fallback value shape', async () => {
    const { service } = createService({
      anniversaryRecommendations: jest
        .fn()
        .mockRejectedValue(new Error('CLIP unavailable')),
    });

    const view = await service.getHome({ cake_like_ids: [] } as never);
    const response = new HomePresenter().response(view);

    expect(normalizeSectionDurations(response)).toEqual(
      fixtures.homeAnniversaryFallback,
    );
  });
});
