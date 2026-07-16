import { StoreService } from './store.service';

const user = {
  firebaseUid: 'viewer-user',
  roles: [],
};

const store = (id: string) => ({
  _id: { toString: () => id },
  name: `store ${id}`,
  logo: {},
  address: `address ${id}`,
  user_like_ids: ['viewer-user'],
  dist: 100,
});

const cake = (id: string, storeId: string) => ({
  _id: id,
  image: {},
  owner_store_id: storeId,
  user_like_ids: [],
  cursor: `cursor-${id}`,
  tag_ins: [],
});

describe('StoreService', () => {
  describe('findAll', () => {
    it('loads recent cakes once and sets hasMore when limit + 1 stores exist', async () => {
      const stores = [store('store-1'), store('store-2'), store('store-3')];
      const storeRepository = {
        findByGeoNear: jest.fn().mockResolvedValue(stores),
      };
      const cakeRepository = {
        findRecentByStoreIds: jest.fn().mockResolvedValue(
          new Map([
            ['store-1', [cake('cake-1', 'store-1')]],
            ['store-2', [cake('cake-2', 'store-2')]],
          ]),
        ),
      };
      const service = new StoreService(
        cakeRepository as any,
        {} as any,
        storeRepository as any,
      );

      const result = await service.findAll(
        user as any,
        37.5,
        127.1,
        3000,
        0,
        2,
      );

      expect(storeRepository.findByGeoNear).toHaveBeenCalledTimes(1);
      expect(storeRepository.findByGeoNear).toHaveBeenCalledWith(
        127.1,
        37.5,
        3000,
        0,
        3,
      );
      expect(cakeRepository.findRecentByStoreIds).toHaveBeenCalledTimes(1);
      expect(cakeRepository.findRecentByStoreIds).toHaveBeenCalledWith([
        'store-1',
        'store-2',
      ]);
      expect(result.hasMore).toBe(true);
      expect(result.stores).toHaveLength(2);
      expect(result.stores[0].cakes).toHaveLength(1);
      expect(result.stores[1].cakes).toHaveLength(1);
    });

    it('keeps hasMore false when the result length equals the limit', async () => {
      const stores = [store('store-1'), store('store-2')];
      const storeRepository = {
        findByGeoNear: jest.fn().mockResolvedValue(stores),
      };
      const cakeRepository = {
        findRecentByStoreIds: jest.fn().mockResolvedValue(new Map()),
      };
      const service = new StoreService(
        cakeRepository as any,
        {} as any,
        storeRepository as any,
      );

      const result = await service.findAll(
        user as any,
        37.5,
        127.1,
        3000,
        0,
        2,
      );

      expect(result.hasMore).toBe(false);
      expect(result.stores).toHaveLength(2);
      expect(cakeRepository.findRecentByStoreIds).toHaveBeenCalledTimes(1);
    });

    it('keeps the empty response shape and a single batch boundary call', async () => {
      const storeRepository = {
        findByGeoNear: jest.fn().mockResolvedValue([]),
      };
      const cakeRepository = {
        findRecentByStoreIds: jest.fn().mockResolvedValue(new Map()),
      };
      const service = new StoreService(
        cakeRepository as any,
        {} as any,
        storeRepository as any,
      );

      const result = await service.findAll(
        user as any,
        37.5,
        127.1,
        3000,
        0,
        20,
      );

      expect(cakeRepository.findRecentByStoreIds).toHaveBeenCalledTimes(1);
      expect(cakeRepository.findRecentByStoreIds).toHaveBeenCalledWith([]);
      expect(result).toMatchObject({ stores: [], hasMore: false });
    });
  });
});
