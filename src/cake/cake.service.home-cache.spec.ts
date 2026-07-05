import { of } from 'rxjs';
import { CakeService } from './cake.service';

describe('CakeService home cache', () => {
  function createService() {
    const likedCakeQuery = {
      maxTimeMS: jest.fn().mockReturnThis(),
      then: (
        resolve: (value: { _id: string }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve({ _id: 'cake-1' }).then(resolve, reject),
    };
    const aggregate = {
      limit: jest.fn().mockReturnThis(),
      option: jest.fn().mockReturnThis(),
      then: (
        resolve: (value: unknown[]) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve([]).then(resolve, reject),
    };
    const cakeModel = {
      findOne: jest.fn(() => likedCakeQuery),
      aggregate: jest.fn(() => aggregate),
    };
    const httpService = {
      get: jest.fn(() => of({ data: { result: [] } })),
    };
    const homeMetrics = {
      countDb: jest.fn(),
      countAi: jest.fn(),
      countAiError: jest.fn(),
    };
    const homeCache = {
      getWithSwr: jest.fn(({ refresh }) => refresh()),
    };
    const service = new CakeService(
      cakeModel as never,
      {} as never,
      {} as never,
      {} as never,
      httpService as never,
      {} as never,
      {} as never,
      {} as never,
      homeMetrics as never,
      homeCache as never,
    );

    return { service, homeCache, httpService, cakeModel };
  }

  it('caches recommendation AI results by liked cake id', async () => {
    const { service, homeCache, httpService } = createService();

    await service.findAllByRecommend({
      cake_like_ids: ['cake-1'],
    } as never);

    expect(homeCache.getWithSwr).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'home:similar:cake-1' }),
    );
    expect(httpService.get).toHaveBeenCalledTimes(1);
  });

  it('uses a fixed shared key only in the home newest wrapper', async () => {
    const { service, homeCache, cakeModel } = createService();

    await service.findAllByNewestForHome(4, 100);

    expect(cakeModel.aggregate).toHaveBeenCalledWith([
      { $match: { is_delete: false } },
      { $sort: { _id: -1 } },
    ]);
    expect(homeCache.getWithSwr).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'home:newest:4' }),
    );
  });

  it('does not use a deleted liked cake as a recommendation seed', async () => {
    const { service, cakeModel } = createService();

    await service.findAllByRecommend({
      cake_like_ids: ['cake-1'],
    } as never);

    expect(cakeModel.findOne).toHaveBeenCalledWith({
      _id: 'cake-1',
      is_delete: false,
    });
  });
});
