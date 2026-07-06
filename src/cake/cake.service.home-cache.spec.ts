import { CakeService } from './cake.service';

describe('CakeService home cache', () => {
  function createService() {
    const cakeRepository = {
      findById: jest.fn().mockResolvedValue({ _id: 'cake-1' }),
      sampleOne: jest.fn().mockResolvedValue({ _id: 'random-cake' }),
      findNewest: jest.fn().mockResolvedValue([]),
    };
    const vitClient = {
      similarSearch: jest.fn().mockResolvedValue([]),
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
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      homeMetrics as never,
      homeCache as never,
      {} as never,
      vitClient as never,
      {} as never,
      {} as never,
      cakeRepository as never,
    );

    return { service, homeCache, vitClient, cakeRepository };
  }

  it('caches recommendation AI results by liked cake id', async () => {
    const { service, homeCache, vitClient } = createService();

    await service.findAllByRecommend({
      cake_like_ids: ['cake-1'],
    } as never);

    expect(homeCache.getWithSwr).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'home:similar:cake-1' }),
    );
    expect(vitClient.similarSearch).toHaveBeenCalledWith(
      'cake-1',
      6,
      undefined,
    );
  });

  it('uses a fixed shared key only in the home newest wrapper', async () => {
    const { service, homeCache, cakeRepository } = createService();

    await service.findAllByNewestForHome(4, 100);

    expect(cakeRepository.findNewest).toHaveBeenCalledWith(undefined, 5, 100);
    expect(homeCache.getWithSwr).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'home:newest:4' }),
    );
  });

  it('does not use a deleted liked cake as a recommendation seed', async () => {
    const { service, cakeRepository } = createService();
    cakeRepository.findById.mockResolvedValueOnce(null);

    await service.findAllByRecommend({
      cake_like_ids: ['cake-1'],
    } as never);

    expect(cakeRepository.findById).toHaveBeenCalledWith('cake-1', undefined);
    expect(cakeRepository.sampleOne).toHaveBeenCalledWith(undefined);
  });
});
