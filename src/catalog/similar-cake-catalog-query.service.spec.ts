import similarCakes from '../../test/fixtures/similar-cakes.mock.json';
import { SimilarCakeCatalogQueryService } from './similar-cake-catalog-query.service';

const buildMetricsService = () => ({
  startSimilarSearch: jest.fn(() => jest.fn()),
  startStoreQuery: jest.fn(() => jest.fn()),
});

const stores = [
  ['mock-store-1', 'vanilla'],
  ['mock-store-2', 'strawberry'],
  ['mock-store-3', 'earl-grey'],
  ['mock-store-4', 'cream-cheese'],
].map(([id, taste], index) => ({
  id,
  name: `Mock Store ${index + 1}`,
  address: `Seoul mock address ${index + 1}`,
  taste: [taste],
  longitude: 127.01 + index * 0.01,
  latitude: 37.01 + index * 0.01,
}));

const buildService = (storeReader, vitClient, metricsService) =>
  new SimilarCakeCatalogQueryService(
    storeReader as any,
    vitClient as any,
    metricsService as any,
  );

describe('SimilarCakeCatalogQueryService', () => {
  it('delegates VIT call and hydrates deduplicated stores once', async () => {
    const vitClient = {
      similarSearchWithLocation: jest
        .fn()
        .mockResolvedValue(similarCakes.result),
    };
    const storeReader = {
      findSummariesByIds: jest.fn().mockResolvedValue(stores),
    };
    const service = buildService(storeReader, vitClient, buildMetricsService());

    const response = await service.execute(
      'mock-cake-origin',
      127.01,
      37.01,
      3000,
      6,
    );

    expect(vitClient.similarSearchWithLocation).toHaveBeenCalledTimes(1);
    expect(vitClient.similarSearchWithLocation).toHaveBeenCalledWith(
      'mock-cake-origin',
      127.01,
      37.01,
      3000,
      6,
    );
    expect(storeReader.findSummariesByIds).toHaveBeenCalledTimes(1);
    expect(storeReader.findSummariesByIds).toHaveBeenCalledWith([
      'mock-store-1',
      'mock-store-2',
      'mock-store-3',
      'mock-store-4',
    ]);
    expect(response.cakes).toHaveLength(6);
  });

  it('excludes cakes whose stores are missing from the batch result', async () => {
    const vitClient = {
      similarSearchWithLocation: jest
        .fn()
        .mockResolvedValue(similarCakes.result),
    };
    const storeReader = {
      findSummariesByIds: jest.fn().mockResolvedValue(stores.slice(0, 3)),
    };
    const service = buildService(storeReader, vitClient, buildMetricsService());

    const response = await service.execute(
      'mock-cake-origin',
      127.01,
      37.01,
      3000,
      6,
    );

    expect(response.cakes).toHaveLength(5);
    expect(response.cakes.map((cake) => cake.ownerStoreId)).not.toContain(
      'mock-store-4',
    );
  });

  it('keeps an empty response and one empty store batch call', async () => {
    const vitClient = {
      similarSearchWithLocation: jest.fn().mockResolvedValue([]),
    };
    const storeReader = { findSummariesByIds: jest.fn().mockResolvedValue([]) };
    const service = buildService(storeReader, vitClient, buildMetricsService());

    const response = await service.execute(
      'mock-cake-origin',
      127.01,
      37.01,
      3000,
      6,
    );

    expect(storeReader.findSummariesByIds).toHaveBeenCalledTimes(1);
    expect(storeReader.findSummariesByIds).toHaveBeenCalledWith([]);
    expect(response).toMatchObject({ cakes: [], hasMore: false });
  });

  it('keeps success and store-query metric labels without duplicating AI metrics', async () => {
    const endSimilar = jest.fn();
    const endStoreQuery = jest.fn();
    const startAiCallTimer = jest.fn();
    const metricsService = {
      startSimilarSearch: jest.fn(() => endSimilar),
      startStoreQuery: jest.fn(() => endStoreQuery),
      startCall: startAiCallTimer,
      countError: jest.fn(),
    };
    const vitClient = {
      similarSearchWithLocation: jest
        .fn()
        .mockResolvedValue(similarCakes.result),
    };
    const storeReader = {
      findSummariesByIds: jest.fn().mockResolvedValue(stores),
    };
    const service = buildService(storeReader, vitClient, metricsService);

    await service.execute('mock-cake-origin', 127.01, 37.01, 3000, 6);

    expect(endSimilar).toHaveBeenCalledWith('success');
    expect(endStoreQuery).toHaveBeenCalledTimes(1);
    expect(startAiCallTimer).not.toHaveBeenCalled();
    expect(metricsService.countError).not.toHaveBeenCalled();
  });

  it('keeps the error metric label and skips store hydration when VIT fails', async () => {
    const endSimilar = jest.fn();
    const metricsService = {
      startSimilarSearch: jest.fn(() => endSimilar),
      startStoreQuery: jest.fn(() => jest.fn()),
      startCall: jest.fn(),
      countError: jest.fn(),
    };
    const vitClient = {
      similarSearchWithLocation: jest
        .fn()
        .mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout' }),
    };
    const storeReader = { findSummariesByIds: jest.fn() };
    const service = buildService(storeReader, vitClient, metricsService);

    await expect(
      service.execute('mock-cake-origin', 127.01, 37.01, 3000, 6),
    ).rejects.toMatchObject({ code: 'ECONNABORTED' });

    expect(endSimilar).toHaveBeenCalledWith('error');
    expect(storeReader.findSummariesByIds).not.toHaveBeenCalled();
  });
});
