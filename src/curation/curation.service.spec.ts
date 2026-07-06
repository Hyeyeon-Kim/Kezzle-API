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
      findById: jest.fn().mockResolvedValue({ _id: 'cur-1', key: 'birthday' }),
      updateOne: jest.fn().mockResolvedValue(undefined),
    };
    const httpService = {
      get: jest.fn(() => ({
        toPromise: () =>
          Promise.resolve({ data: { result: [{ _id: 'clip-cake' }] } }),
      })),
    };
    const cakeService = {
      findAllByRecommend:
        overrides?.recommend ?? jest.fn().mockResolvedValue([]),
      popular: overrides?.popular ?? jest.fn().mockResolvedValue(popularCakes),
      findAllByNewest:
        overrides?.newest ?? jest.fn().mockResolvedValue(newestCakes),
      findAllByNewestForHome:
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
      countAi: jest.fn(),
      countAiError: jest.fn(),
      countBackgroundRefresh: jest.fn(),
      countCache: jest.fn(),
      flush: jest.fn(),
    };
    const homeCache = {
      getWithSwr: jest.fn(({ refresh }) => refresh()),
    };
    const monitoring = {
      observeHomeRequest: jest.fn(),
      countHomeDegraded: jest.fn(),
      observeHomeSection: jest.fn(),
      countDbCall: jest.fn(),
      countAiCall: jest.fn(),
      countCacheEvent: jest.fn(),
    };

    const service = new CurationService(
      curationModel as never,
      httpService as never,
      cakeService as never,
      anniversaryService as never,
      searchService as never,
      homeMetrics as never,
      homeCache as never,
      monitoring as never,
    );

    return {
      service,
      cakeService,
      anniversaryService,
      searchService,
      homeMetrics,
      homeCache,
      curationQuery,
      curationModel,
      httpService,
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

  it('does not trigger curation refresh from the home path even when stale', async () => {
    const { service, curationQuery, httpService } = createService();
    const staleCuration = {
      _id: 'curation-1',
      key: 'fixture curation',
      updatedAt: new Date('2020-01-01T00:00:00.000Z'),
      cakes: [],
    };
    curationQuery.then = (
      resolve: (value: unknown[]) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve([staleCuration]).then(resolve, reject);
    const updateSpy = jest.spyOn(service, 'updateCuration');

    const response = await service.homeCurationV2({} as never);

    expect(updateSpy).not.toHaveBeenCalled();
    expect(httpService.get).not.toHaveBeenCalled();
    expect(response.curations).toEqual([
      { _id: 'curation-1', cakes: [], description: 'fixture curation' },
    ]);
    expect(response.sections.curations.status).toBe('success');
  });

  it('updateCuration bumps the curation via updateOne even when content is unchanged', async () => {
    const { service, curationModel } = createService();

    await service.updateCuration('cur-1');

    expect(curationModel.updateOne).toHaveBeenCalledWith(
      { _id: 'cur-1' },
      { $set: { cakes: [{ _id: 'clip-cake' }] } },
    );
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
    expect(cakeService.findAllByNewestForHome).toHaveBeenCalledWith(4, 100);
    expect(curationQuery.maxTimeMS).toHaveBeenCalledWith(100);
  });

  it('uses the shared cache for the curations section', async () => {
    const { service, homeCache } = createService();

    await service.homeCurationV2({} as never);

    expect(homeCache.getWithSwr).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'home:curations' }),
    );
    expect(homeCache.getWithSwr).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'home:popular' }),
    );
    expect(homeCache.getWithSwr).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'home:keyword-ranks' }),
    );
  });
});
