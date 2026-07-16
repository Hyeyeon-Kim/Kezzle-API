import { SimilarCakeService } from './similar-cake.service';
import similarCakes from '../../test/fixtures/similar-cakes.mock.json';

const buildMetricsService = () => ({
  similarSearchDuration: { startTimer: jest.fn(() => jest.fn()) },
  aiApiCallDuration: { startTimer: jest.fn(() => jest.fn()) },
  storeQueryDuration: { startTimer: jest.fn(() => jest.fn()) },
  aiApiErrors: { inc: jest.fn() },
});

const mockStores = [
  {
    _id: { toString: () => 'mock-store-1' },
    name: 'Mock Store 1',
    address: 'Seoul mock address 1',
    taste: ['vanilla', 'choco'],
    location: { coordinates: [127.01, 37.01] },
  },
  {
    _id: { toString: () => 'mock-store-2' },
    name: 'Mock Store 2',
    address: 'Seoul mock address 2',
    taste: ['strawberry'],
    location: { coordinates: [127.02, 37.02] },
  },
  {
    _id: { toString: () => 'mock-store-3' },
    name: 'Mock Store 3',
    address: 'Seoul mock address 3',
    taste: ['earl-grey'],
    location: { coordinates: [127.03, 37.03] },
  },
  {
    _id: { toString: () => 'mock-store-4' },
    name: 'Mock Store 4',
    address: 'Seoul mock address 4',
    taste: ['cream-cheese'],
    location: { coordinates: [127.04, 37.04] },
  },
];

const STORE_PROJECTION = {
  name: 1,
  address: 1,
  taste: 1,
  location: 1,
};

describe('SimilarCakeService', () => {
  describe('execute', () => {
    it('delegates VIT call to VitClient and loads stores via StoreRepository once', async () => {
      const vitClient = {
        similarSearchWithLocation: jest
          .fn()
          .mockResolvedValue(similarCakes.result),
        similarSearch: jest.fn(),
      };
      const storeRepository = {
        findByIdsWithProjection: jest.fn().mockResolvedValue(mockStores),
      };
      const metricsService = buildMetricsService();

      const service = new SimilarCakeService(
        storeRepository as any,
        vitClient as any,
        metricsService as any,
      );

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
      expect(storeRepository.findByIdsWithProjection).toHaveBeenCalledTimes(1);
      expect(storeRepository.findByIdsWithProjection).toHaveBeenCalledWith(
        ['mock-store-1', 'mock-store-2', 'mock-store-3', 'mock-store-4'],
        STORE_PROJECTION,
      );
      expect(response.cakes).toHaveLength(6);
    });

    it('excludes cakes whose stores are missing from batch result', async () => {
      const vitClient = {
        similarSearchWithLocation: jest
          .fn()
          .mockResolvedValue(similarCakes.result),
        similarSearch: jest.fn(),
      };
      const storeRepository = {
        findByIdsWithProjection: jest
          .fn()
          .mockResolvedValue(mockStores.slice(0, 3)),
      };
      const metricsService = buildMetricsService();

      const service = new SimilarCakeService(
        storeRepository as any,
        vitClient as any,
        metricsService as any,
      );

      const response = await service.execute(
        'mock-cake-origin',
        127.01,
        37.01,
        3000,
        6,
      );

      expect(response.cakes).toHaveLength(5);
      expect(response.cakes.map((cake) => cake.owner_store_id)).not.toContain(
        'mock-store-4',
      );
    });

    it('keeps an empty response and one empty store batch boundary call', async () => {
      const vitClient = {
        similarSearchWithLocation: jest.fn().mockResolvedValue([]),
        similarSearch: jest.fn(),
      };
      const storeRepository = {
        findByIdsWithProjection: jest.fn().mockResolvedValue([]),
      };
      const metricsService = buildMetricsService();

      const service = new SimilarCakeService(
        storeRepository as any,
        vitClient as any,
        metricsService as any,
      );

      const response = await service.execute(
        'mock-cake-origin',
        127.01,
        37.01,
        3000,
        6,
      );

      expect(storeRepository.findByIdsWithProjection).toHaveBeenCalledTimes(1);
      expect(storeRepository.findByIdsWithProjection).toHaveBeenCalledWith(
        [],
        STORE_PROJECTION,
      );
      expect(response).toMatchObject({ cakes: [], hasMore: false });
    });

    it('records outer similarSearchDuration success and does not double-record AI metrics', async () => {
      const endSimilar = jest.fn();
      const endStoreQuery = jest.fn();
      const startAiCallTimer = jest.fn();

      const vitClient = {
        similarSearchWithLocation: jest
          .fn()
          .mockResolvedValue(similarCakes.result),
        similarSearch: jest.fn(),
      };
      const storeRepository = {
        findByIdsWithProjection: jest.fn().mockResolvedValue(mockStores),
      };
      const metricsService = {
        similarSearchDuration: { startTimer: jest.fn(() => endSimilar) },
        aiApiCallDuration: { startTimer: startAiCallTimer },
        storeQueryDuration: { startTimer: jest.fn(() => endStoreQuery) },
        aiApiErrors: { inc: jest.fn() },
      };

      const service = new SimilarCakeService(
        storeRepository as any,
        vitClient as any,
        metricsService as any,
      );

      await service.execute('mock-cake-origin', 127.01, 37.01, 3000, 6);

      expect(endSimilar).toHaveBeenCalledWith({ status: 'success' });
      expect(endStoreQuery).toHaveBeenCalledTimes(1);
      expect(startAiCallTimer).not.toHaveBeenCalled();
      expect(metricsService.aiApiErrors.inc).not.toHaveBeenCalled();
    });

    it('records outer similarSearchDuration as error when VitClient throws', async () => {
      const endSimilar = jest.fn();
      const startAiCallTimer = jest.fn();

      const vitClient = {
        similarSearchWithLocation: jest
          .fn()
          .mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout' }),
        similarSearch: jest.fn(),
      };
      const storeRepository = {
        findByIdsWithProjection: jest.fn(),
      };
      const metricsService = {
        similarSearchDuration: { startTimer: jest.fn(() => endSimilar) },
        aiApiCallDuration: { startTimer: startAiCallTimer },
        storeQueryDuration: { startTimer: jest.fn(() => jest.fn()) },
        aiApiErrors: { inc: jest.fn() },
      };

      const service = new SimilarCakeService(
        storeRepository as any,
        vitClient as any,
        metricsService as any,
      );

      await expect(
        service.execute('mock-cake-origin', 127.01, 37.01, 3000, 6),
      ).rejects.toMatchObject({ code: 'ECONNABORTED' });

      expect(endSimilar).toHaveBeenCalledWith({ status: 'error' });
      expect(startAiCallTimer).not.toHaveBeenCalled();
      expect(metricsService.aiApiErrors.inc).not.toHaveBeenCalled();
      expect(storeRepository.findByIdsWithProjection).not.toHaveBeenCalled();
    });
  });
});
