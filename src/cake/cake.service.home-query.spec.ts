import { CakeService } from './cake.service';

describe('CakeService home query surface', () => {
  function createService() {
    const cakeRepository = {
      findById: jest.fn().mockResolvedValue({ id: 'cake-1' }),
      sampleOne: jest.fn().mockResolvedValue({ id: 'random-cake' }),
      findNewest: jest.fn().mockResolvedValue([]),
    };
    const vitClient = {
      similarSearch: jest.fn().mockResolvedValue([]),
    };
    const service = new CakeService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      vitClient as never,
      {} as never,
      {} as never,
      cakeRepository as never,
    );

    return { service, vitClient, cakeRepository };
  }

  it('resolves a valid liked cake as the recommendation seed', async () => {
    const { service, cakeRepository } = createService();

    const seed = await service.findRecommendationSeed({
      cakeLikeIds: ['cake-1'],
    } as never);

    expect(seed).toBe('cake-1');
    expect(cakeRepository.findById).toHaveBeenCalledWith('cake-1', undefined);
    expect(cakeRepository.sampleOne).not.toHaveBeenCalled();
  });

  it('falls back to a random cake when a liked cake was deleted', async () => {
    const { service, cakeRepository } = createService();
    cakeRepository.findById.mockResolvedValueOnce(null);

    const seed = await service.findRecommendationSeed({
      cakeLikeIds: ['cake-1'],
    } as never);

    expect(seed).toBe('random-cake');
    expect(cakeRepository.sampleOne).toHaveBeenCalledWith(undefined);
  });

  it('returns null when there is no valid recommendation seed', async () => {
    const { service, cakeRepository, vitClient } = createService();
    cakeRepository.findById.mockResolvedValueOnce(null);
    cakeRepository.sampleOne.mockResolvedValueOnce(null);

    const seed = await service.findRecommendationSeed({
      cakeLikeIds: ['deleted-cake'],
    } as never);

    expect(seed).toBeNull();
    expect(vitClient.similarSearch).not.toHaveBeenCalled();
  });

  it('loads recommendations without owning Home cache policy', async () => {
    const { service, vitClient } = createService();

    await service.findAllByRecommend('cake-1');

    expect(vitClient.similarSearch).toHaveBeenCalledWith(
      'cake-1',
      6,
      undefined,
    );
  });
});
