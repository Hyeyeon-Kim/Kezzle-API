import { of, throwError } from 'rxjs';
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

describe('SimilarCakeService', () => {
  const originalVitBaseUrl = process.env.VIT_API_BASE_URL;

  beforeEach(() => {
    delete process.env.VIT_API_BASE_URL;
  });

  afterAll(() => {
    if (originalVitBaseUrl === undefined) {
      delete process.env.VIT_API_BASE_URL;
    } else {
      process.env.VIT_API_BASE_URL = originalVitBaseUrl;
    }
  });

  describe('execute', () => {
    it('keeps response shape and batch loads stores once', async () => {
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: similarCakes })),
      };
      const storeModel = {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockStores),
        }),
      };
      const metricsService = buildMetricsService();

      const service = new SimilarCakeService(
        storeModel as any,
        httpService as any,
        metricsService as any,
      );

      const response = await service.execute(
        'mock-cake-origin',
        127.01,
        37.01,
        3000,
        6,
      );

      const ownerStoreIds = similarCakes.result.map(
        (cake) => cake.owner_store_id,
      );
      const uniqueOwnerStoreIds = new Set(ownerStoreIds);

      expect(httpService.get).toHaveBeenCalledTimes(1);
      expect(httpService.get).toHaveBeenCalledWith(
        'https://api.kezzlecake.com/vit/cakes/similar-search?id=mock-cake-origin&lon=127.01&lat=37.01&dist=3000&size=6',
      );
      expect(storeModel.find).toHaveBeenCalledTimes(1);
      expect(storeModel.find).toHaveBeenCalledWith(
        {
          _id: {
            $in: [
              'mock-store-1',
              'mock-store-2',
              'mock-store-3',
              'mock-store-4',
            ],
          },
        },
        { name: 1, address: 1, taste: 1, location: 1 },
      );
      expect(ownerStoreIds).toHaveLength(6);
      expect(uniqueOwnerStoreIds.size).toBe(4);
      expect(response.hasMore).toBe(false);
      expect(response.cakes).toHaveLength(6);
      expect(response.cakes.map((cake) => cake._id)).toEqual(
        similarCakes.result.map((cake) => cake.id),
      );
      expect(response.cakes[0]).toMatchObject({
        _id: 'mock-cake-1',
        image: { s3Url: 'https://example.com/mock-cake-1.jpg' },
        owner_store_id: 'mock-store-1',
        owner_store_name: 'Mock Store 1',
        owner_store_address: 'Seoul mock address 1',
        owner_store_taste: ['vanilla', 'choco'],
        owner_store_latitude: 37.01,
        owner_store_longitude: 127.01,
      });
    });

    it('excludes cakes whose stores are missing from batch result', async () => {
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: similarCakes })),
      };
      const storeModel = {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockStores.slice(0, 3)),
        }),
      };
      const metricsService = buildMetricsService();

      const service = new SimilarCakeService(
        storeModel as any,
        httpService as any,
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

    it('records success metrics on the happy path', async () => {
      const endSimilar = jest.fn();
      const endAiCall = jest.fn();
      const endStoreQuery = jest.fn();

      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: similarCakes })),
      };
      const storeModel = {
        find: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockStores),
        }),
      };
      const metricsService = {
        similarSearchDuration: { startTimer: jest.fn(() => endSimilar) },
        aiApiCallDuration: { startTimer: jest.fn(() => endAiCall) },
        storeQueryDuration: { startTimer: jest.fn(() => endStoreQuery) },
        aiApiErrors: { inc: jest.fn() },
      };

      const service = new SimilarCakeService(
        storeModel as any,
        httpService as any,
        metricsService as any,
      );

      await service.execute('mock-cake-origin', 127.01, 37.01, 3000, 6);

      expect(endAiCall).toHaveBeenCalledWith({ status: 'success' });
      expect(endStoreQuery).toHaveBeenCalledTimes(1);
      expect(endSimilar).toHaveBeenCalledWith({ status: 'success' });
      expect(metricsService.aiApiErrors.inc).not.toHaveBeenCalled();
    });

    it('records error metrics when the AI API call fails', async () => {
      const endSimilar = jest.fn();
      const endAiCall = jest.fn();
      const endStoreQuery = jest.fn();

      const httpService = {
        get: jest
          .fn()
          .mockReturnValue(
            throwError(() => ({ code: 'ECONNABORTED', message: 'timeout' })),
          ),
      };
      const storeModel = { find: jest.fn() };
      const metricsService = {
        similarSearchDuration: { startTimer: jest.fn(() => endSimilar) },
        aiApiCallDuration: { startTimer: jest.fn(() => endAiCall) },
        storeQueryDuration: { startTimer: jest.fn(() => endStoreQuery) },
        aiApiErrors: { inc: jest.fn() },
      };

      const service = new SimilarCakeService(
        storeModel as any,
        httpService as any,
        metricsService as any,
      );

      await expect(
        service.execute('mock-cake-origin', 127.01, 37.01, 3000, 6),
      ).rejects.toMatchObject({ code: 'ECONNABORTED' });

      expect(endAiCall).toHaveBeenCalledWith({ status: 'timeout' });
      expect(metricsService.aiApiErrors.inc).toHaveBeenCalledWith({
        reason: 'timeout',
      });
      expect(endSimilar).toHaveBeenCalledWith({ status: 'error' });
      expect(storeModel.find).not.toHaveBeenCalled();
    });
  });
});
