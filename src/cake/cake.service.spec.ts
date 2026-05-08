import { of } from 'rxjs';
import { CakeService } from './cake.service';
import similarCakes from '../../test/fixtures/similar-cakes.mock.json';

describe('CakeService', () => {
  describe('similar', () => {
    const mockStores = [
      {
        _id: { toString: () => 'mock-store-1' },
        name: 'Mock Store 1',
        address: 'Seoul mock address 1',
        taste: ['vanilla', 'choco'],
        longitude: '127.01',
        latitude: '37.01',
      },
      {
        _id: { toString: () => 'mock-store-2' },
        name: 'Mock Store 2',
        address: 'Seoul mock address 2',
        taste: ['strawberry'],
        longitude: '127.02',
        latitude: '37.02',
      },
      {
        _id: { toString: () => 'mock-store-3' },
        name: 'Mock Store 3',
        address: 'Seoul mock address 3',
        taste: ['earl-grey'],
        longitude: '127.03',
        latitude: '37.03',
      },
      {
        _id: { toString: () => 'mock-store-4' },
        name: 'Mock Store 4',
        address: 'Seoul mock address 4',
        taste: ['cream-cheese'],
        longitude: '127.04',
        latitude: '37.04',
      },
    ];

    it('keeps response shape and batch loads stores once', async () => {
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: similarCakes })),
      };
      const storeService = {
        findOne: jest.fn(),
      };
      const storeModel = {
        find: jest.fn().mockResolvedValue(mockStores),
      };
      const service = new CakeService(
        {} as any,
        storeModel as any,
        {} as any,
        storeService as any,
        httpService as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const response = await service.similar(
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
      expect(storeService.findOne).not.toHaveBeenCalled();
      expect(storeModel.find).toHaveBeenCalledTimes(1);
      expect(storeModel.find).toHaveBeenCalledWith({
        _id: {
          $in: ['mock-store-1', 'mock-store-2', 'mock-store-3', 'mock-store-4'],
        },
      });
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
        owner_store_latitude: '37.01',
        owner_store_longitude: '127.01',
      });
    });

    it('excludes cakes whose stores are missing from batch result', async () => {
      const httpService = {
        get: jest.fn().mockReturnValue(of({ data: similarCakes })),
      };
      const storeModel = {
        find: jest.fn().mockResolvedValue(mockStores.slice(0, 3)),
      };
      const service = new CakeService(
        {} as any,
        storeModel as any,
        {} as any,
        { findOne: jest.fn() } as any,
        httpService as any,
        {} as any,
        {} as any,
        {} as any,
      );

      const response = await service.similar(
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
  });
});
