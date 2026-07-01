import { ServiceUnavailableException } from '@nestjs/common';
import { CurationService } from './curation.service';

describe('CurationService homeCurationV2', () => {
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
    expect(response.popularCakes).toEqual({
      startDate: '2023-01-01',
      endDate: '2023-12-31',
      cakes: [],
    });
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
