import { ServiceUnavailableException } from '@nestjs/common';
import fixtures from '../../../test/fixtures/type-boundary-read.contract.json';
import { homeConfigFixture } from '../../../test/support/typed-config.fixtures';
import { HomePresenter } from '../api/home.presenter';
import { HomeFeedService } from './home-feed.service';

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
  const fallbacks = {
    recommendCakes: [],
    anniversary: { id: '', name: '', dday: '', mention: '', images: [] },
    popularCakes: {
      cakes: [],
      startDate: '2023-01-01',
      endDate: '2023-12-31',
    },
    keywordRanks: {
      ranking: [],
      startDate: '2023-01-01',
      endDate: '2023-11-25',
    },
    newestCakes: { cakes: [], hasMore: false },
    curations: [],
  };

  function createService(overrides?: {
    recommend?: jest.Mock;
    anniversary?: jest.Mock;
    popular?: jest.Mock;
    keywordRanks?: jest.Mock;
    newest?: jest.Mock;
    curations?: jest.Mock;
    config?: any;
  }) {
    const sectionLoader = {
      getFallbacks: jest.fn().mockReturnValue(fallbacks),
      loadRecommendCakes:
        overrides?.recommend ?? jest.fn().mockResolvedValue([]),
      loadAnniversary:
        overrides?.anniversary ?? jest.fn().mockResolvedValue(anniversary),
      loadPopularCakes:
        overrides?.popular ?? jest.fn().mockResolvedValue(popularCakes),
      loadKeywordRanks:
        overrides?.keywordRanks ?? jest.fn().mockResolvedValue(keywordRanks),
      loadNewestCakes:
        overrides?.newest ?? jest.fn().mockResolvedValue(newestCakes),
      loadCurations:
        overrides?.curations ?? jest.fn().mockResolvedValue([]),
    };
    const homeMetrics = {
      run: jest.fn((callback: () => Promise<unknown>) => callback()),
      timeSection: jest.fn((_name: string, callback: () => Promise<unknown>) =>
        callback(),
      ),
      observeRequest: jest.fn(),
      observeSection: jest.fn(),
      countDegraded: jest.fn(),
      flush: jest.fn(),
    };
    const service = new HomeFeedService(
      sectionLoader as never,
      homeMetrics as never,
      overrides?.config ?? homeConfigFixture,
    );

    return { service, sectionLoader, homeMetrics };
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
    expect(Object.values(response.sections)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'success' }),
      ]),
    );
    expect(
      Object.values(response.sections).every(
        (section) => section.status === 'success',
      ),
    ).toBe(true);
  });

  it('returns a typed fallback when an optional section fails', async () => {
    const { service, homeMetrics } = createService({
      anniversary: jest.fn().mockRejectedValue(new Error('CLIP unavailable')),
    });

    const response = await service.getHome({ cake_like_ids: [] } as never);

    expect(response.degraded).toBe(true);
    expect(response.anniversary).toEqual(fallbacks.anniversary);
    expect(response.sections.anniversary).toMatchObject({
      status: 'fallback',
      reason: 'dependency_error',
    });
    expect(homeMetrics.countDegraded).toHaveBeenCalledTimes(1);
  });

  it('fails with 503 only when all core sections fail', async () => {
    const failure = () => jest.fn().mockRejectedValue(new Error('unavailable'));
    const { service, homeMetrics } = createService({
      recommend: failure(),
      popular: failure(),
      newest: failure(),
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
          recommendCakes: 5_000,
        },
      },
      recommend: jest.fn(
        (_user: unknown, _timeoutMs: number, signal: AbortSignal) => {
          recommendSignal = signal;
          return new Promise((_, reject) => {
            signal.addEventListener('abort', () => {
              reject(new Error('dependency aborted'));
            });
          });
        },
      ),
    });

    const response = await service.getHome({ cake_like_ids: [] } as never);

    expect(response.degraded).toBe(true);
    expect(response.sections.recommendCakes).toMatchObject({
      status: 'fallback',
      reason: 'timeout',
    });
    expect(recommendSignal?.aborted).toBe(true);
  });

  it('starts all sections with the configured timeout budgets', async () => {
    const { service, sectionLoader } = createService();

    await service.getHome({ cake_like_ids: [] } as never);

    expect(sectionLoader.loadRecommendCakes).toHaveBeenCalledWith(
      expect.anything(),
      250,
      expect.any(AbortSignal),
    );
    expect(sectionLoader.loadAnniversary).toHaveBeenCalledWith(
      250,
      expect.any(AbortSignal),
    );
    expect(sectionLoader.loadPopularCakes).toHaveBeenCalledWith(50);
    expect(sectionLoader.loadKeywordRanks).toHaveBeenCalledWith(400);
    expect(sectionLoader.loadNewestCakes).toHaveBeenCalledWith(100);
    expect(sectionLoader.loadCurations).toHaveBeenCalledWith(100);
  });

  it('keeps the fixture-backed Home response shape', async () => {
    const cacheValues = fixtures.homeCacheValues as Record<string, any>;
    const { service } = createService({
      recommend: jest
        .fn()
        .mockResolvedValue(cacheValues['home:v2:similar:seed-cake']),
      anniversary: jest
        .fn()
        .mockResolvedValue(cacheValues['home:v2:anniversary']),
      popular: jest.fn().mockResolvedValue(cacheValues['home:v2:popular']),
      keywordRanks: jest
        .fn()
        .mockResolvedValue(cacheValues['home:v2:keyword-ranks']),
      newest: jest.fn().mockResolvedValue(cacheValues['home:v2:newest:4']),
      curations: jest.fn().mockResolvedValue(cacheValues['home:v2:curations']),
    });

    const view = await service.getHome({ cake_like_ids: [] } as never);
    const response = new HomePresenter().response(view);

    expect(normalizeSectionDurations(response)).toEqual(fixtures.home);
  });
});
