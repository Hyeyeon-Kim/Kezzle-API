import { CakeService } from './cake.service';

const user = {
  firebaseUid: 'viewer-user',
  roles: [],
};

const cake = (id: string, storeId = 'store-1') => ({
  _id: id,
  image: {},
  owner_store_id: storeId,
  user_like_ids: [],
  cursor: `cursor-${id}`,
  tag_ins: [],
});

const buildService = ({
  storeRepository = {},
  cakeRepository = {},
  similarCakeService = {},
}: {
  storeRepository?: Record<string, any>;
  cakeRepository?: Record<string, any>;
  similarCakeService?: Record<string, any>;
}) =>
  new CakeService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    similarCakeService as any,
    {} as any,
    {} as any,
    storeRepository as any,
    cakeRepository as any,
  );

describe('CakeService', () => {
  describe('catalog pagination baseline', () => {
    it('findAll queries each repository once and sets hasMore for limit + 1 cakes', async () => {
      const storeRepository = {
        findIdsByGeoNear: jest.fn().mockResolvedValue(['store-1']),
      };
      const cakeRepository = {
        findInStoresByCursor: jest
          .fn()
          .mockResolvedValue([cake('1'), cake('2'), cake('3')]),
      };
      const service = buildService({ storeRepository, cakeRepository });

      const result = await service.findAll(
        user as any,
        37.5,
        127.1,
        3000,
        'cursor-0',
        2,
      );

      expect(storeRepository.findIdsByGeoNear).toHaveBeenCalledTimes(1);
      expect(storeRepository.findIdsByGeoNear).toHaveBeenCalledWith(
        127.1,
        37.5,
        3000,
      );
      expect(cakeRepository.findInStoresByCursor).toHaveBeenCalledTimes(1);
      expect(cakeRepository.findInStoresByCursor).toHaveBeenCalledWith(
        ['store-1'],
        'cursor-0',
        3,
      );
      expect(result.hasMore).toBe(true);
      expect(result.cakes).toHaveLength(2);
    });

    it('findAllByLocation keeps hasMore false at the exact limit boundary', async () => {
      const storeRepository = {
        findIdsByGeoNear: jest.fn().mockResolvedValue(['store-1']),
      };
      const cakeRepository = {
        findInStoresAfterId: jest
          .fn()
          .mockResolvedValue([cake('1'), cake('2')]),
      };
      const service = buildService({ storeRepository, cakeRepository });

      const result = await service.findAllByLocation(
        user as any,
        37.5,
        127.1,
        3000,
        'after-id',
        2,
      );

      expect(storeRepository.findIdsByGeoNear).toHaveBeenCalledTimes(1);
      expect(cakeRepository.findInStoresAfterId).toHaveBeenCalledTimes(1);
      expect(cakeRepository.findInStoresAfterId).toHaveBeenCalledWith(
        ['store-1'],
        'after-id',
        3,
      );
      expect(result.hasMore).toBe(false);
      expect(result.cakes).toHaveLength(2);
    });

    it('findCake checks the store once and sets hasMore for limit + 1 cakes', async () => {
      const storeRepository = {
        findByIdOrThrow: jest.fn().mockResolvedValue({ _id: 'store-1' }),
      };
      const cakeRepository = {
        findByStoreIdAfter: jest
          .fn()
          .mockResolvedValue([cake('1'), cake('2'), cake('3')]),
      };
      const service = buildService({ storeRepository, cakeRepository });

      const result = await service.findCake(
        'store-1',
        user as any,
        'after-id',
        2,
      );

      expect(storeRepository.findByIdOrThrow).toHaveBeenCalledTimes(1);
      expect(storeRepository.findByIdOrThrow).toHaveBeenCalledWith('store-1');
      expect(cakeRepository.findByStoreIdAfter).toHaveBeenCalledTimes(1);
      expect(cakeRepository.findByStoreIdAfter).toHaveBeenCalledWith(
        'store-1',
        'after-id',
        3,
      );
      expect(result.hasMore).toBe(true);
      expect(result.cakes).toHaveLength(2);
    });
  });

  describe('similar', () => {
    it('delegates to SimilarCakeService.execute with the same arguments', async () => {
      const expected = { cakes: [], hasMore: false } as any;
      const similarCakeService = {
        execute: jest.fn().mockResolvedValue(expected),
      };

      const service = buildService({ similarCakeService });

      const result = await service.similar(
        'mock-cake-origin',
        127.01,
        37.01,
        3000,
        6,
      );

      expect(similarCakeService.execute).toHaveBeenCalledTimes(1);
      expect(similarCakeService.execute).toHaveBeenCalledWith(
        'mock-cake-origin',
        127.01,
        37.01,
        3000,
        6,
      );
      expect(result).toBe(expected);
    });
  });
});
