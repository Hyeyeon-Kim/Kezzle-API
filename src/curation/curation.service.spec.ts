import { ServiceUnavailableException } from '@nestjs/common';
import { CurationService } from './curation.service';

describe('CurationService homeCurationV2', () => {
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
    const curationQuery = {
      limit: jest.fn().mockReturnThis(),
      maxTimeMS: jest.fn().mockReturnThis(),
      then: (
        resolve: (value: unknown[]) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve([]).then(resolve, reject),
    };
    const curationModel = {
      find: jest.fn(() => curationQuery),
    };
    const cakeService = {
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
    const homeMetrics = {
      run: jest.fn((callback: () => Promise<unknown>) => callback()),
      timeSection: jest.fn((_name: string, callback: () => Promise<unknown>) =>
        callback(),
      ),
      countDb: jest.fn(),
      countBackgroundRefresh: jest.fn(),
      flush: jest.fn(),
    };

    const service = new CurationService(
      curationModel as never,
      {} as never,
      cakeService as never,
      anniversaryService as never,
      searchService as never,
      homeMetrics as never,
    );

    return {
      service,
      cakeService,
      anniversaryService,
      searchService,
      homeMetrics,
      curationQuery,
    };
  }

  it('keeps all existing fields and reports healthy sections', async () => {
    const { service } = createService();

    const response = await service.homeCurationV2({} as never);

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

    const response = await service.homeCurationV2({} as never);

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
    expect(response.popularCakes).toEqual(popularCakes);
    expect(response.newestCakes).toEqual(newestCakes);
  });

  it('returns a partial response when one or two core sections fail', async () => {
    const { service } = createService({
      recommend: jest.fn().mockRejectedValue(new Error('VIT unavailable')),
      popular: jest.fn().mockRejectedValue(new Error('Mongo unavailable')),
    });

    const response = await service.homeCurationV2({} as never);

    expect(response.degraded).toBe(true);
    expect(response.recommendCakes).toEqual([]);
    expect(response.popularCakes).toMatchObject({ cakes: [] });
    expect(response.popularCakes.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(response.popularCakes.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(response.newestCakes).toEqual(newestCakes);
  });

  it('fails with 503 only when all core sections fail', async () => {
    const { service, homeMetrics } = createService({
      recommend: jest.fn().mockRejectedValue(new Error('VIT unavailable')),
      popular: jest.fn().mockRejectedValue(new Error('Mongo unavailable')),
      newest: jest.fn().mockRejectedValue(new Error('Mongo unavailable')),
    });

    await expect(service.homeCurationV2({} as never)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(homeMetrics.flush).toHaveBeenCalledWith('error');
  });

  it('runs sections in parallel instead of sequentially', async () => {
    const delay = <T>(ms: number, value: T): Promise<T> =>
      new Promise((resolve) => setTimeout(() => resolve(value), ms));
    const { service } = createService({
      recommend: jest.fn(() => delay(150, [])),
      keywordRanks: jest.fn(() => delay(150, keywordRanks)),
    });

    const started = Date.now();
    const response = await service.homeCurationV2({} as never);
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(280);
    expect(response.sections.recommendCakes.status).toBe('success');
    expect(response.sections.keywordRanks.status).toBe('success');
    expect(response.degraded).toBe(false);
  });

  it('responds at the hard deadline and aborts unfinished sections', async () => {
    process.env.HOME_HARD_DEADLINE_MS = '80';
    process.env.HOME_RECOMMEND_TIMEOUT_MS = '5000';
    let recommendSignal: AbortSignal | undefined;
    const { service } = createService({
      recommend: jest.fn((_user: unknown, signal: AbortSignal) => {
        recommendSignal = signal;
        return new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            reject(new Error('dependency aborted'));
          });
        });
      }),
    });

    const started = Date.now();
    const response = await service.homeCurationV2({} as never);
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(300);
    expect(response.degraded).toBe(true);
    expect(response.recommendCakes).toEqual([]);
    expect(response.sections.recommendCakes).toMatchObject({
      status: 'fallback',
      reason: 'timeout',
    });
    expect(response.anniversary).toEqual(anniversary);
    expect(response.popularCakes).toEqual(popularCakes);
    expect(response.newestCakes).toEqual(newestCakes);
    expect(recommendSignal?.aborted).toBe(true);
  });

  it('keeps the response identical when sections finish within the deadline', async () => {
    process.env.HOME_HARD_DEADLINE_MS = '600';
    const { service } = createService();

    const response = await service.homeCurationV2({} as never);

    expect(response.degraded).toBe(false);
    expect(response.anniversary).toEqual(anniversary);
    expect(response.popularCakes).toEqual(popularCakes);
    expect(response.keywordRanks).toEqual(keywordRanks);
    expect(response.newestCakes).toEqual(newestCakes);
  });

  it('builds a home response even when a section promise rejects unexpectedly', async () => {
    const { service, homeMetrics } = createService();
    homeMetrics.timeSection.mockImplementationOnce(() =>
      Promise.reject(new Error('unexpected metric failure')),
    );

    const response = await service.homeCurationV2({} as never);

    expect(response.degraded).toBe(true);
    expect(response.recommendCakes).toEqual([]);
    expect(response.sections.recommendCakes).toMatchObject({
      status: 'fallback',
      reason: 'dependency_error',
    });
    expect(response.popularCakes).toEqual(popularCakes);
  });

  it('passes measured timeout budgets to section dependencies', async () => {
    const {
      service,
      cakeService,
      anniversaryService,
      searchService,
      curationQuery,
    } = createService();

    await service.homeCurationV2({} as never);

    expect(cakeService.findAllByRecommend).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(AbortSignal),
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
    expect(curationQuery.maxTimeMS).toHaveBeenCalledWith(100);
  });
});
