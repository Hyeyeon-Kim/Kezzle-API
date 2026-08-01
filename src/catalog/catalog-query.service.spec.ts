import { CatalogQueryService } from './catalog-query.service';

const cake = (id: string, storeId = 'store-1') => ({
  id,
  image: {},
  ownerStoreId: storeId,
  likedUserIds: [],
  cursor: `cursor-${id}`,
  tags: [],
});

const store = (id: string) => ({
  id,
  name: `store ${id}`,
  logo: {},
  address: `address ${id}`,
  likedUserIds: ['viewer-user'],
  distance: 100,
});

const buildService = (cakeReader = {}, storeReader = {}) =>
  new CatalogQueryService(cakeReader as any, storeReader as any);

describe('CatalogQueryService', () => {
  it('queries each reader once and sets hasMore for cursor cake results', async () => {
    const storeReader = {
      findIdsByGeoNear: jest.fn().mockResolvedValue(['store-1']),
    };
    const cakeReader = {
      findInStoresByCursor: jest
        .fn()
        .mockResolvedValue([cake('1'), cake('2'), cake('3')]),
    };
    const service = buildService(cakeReader, storeReader);

    const result = await service.findAllCakes(37.5, 127.1, 3000, 'cursor-0', 2);

    expect(storeReader.findIdsByGeoNear).toHaveBeenCalledTimes(1);
    expect(storeReader.findIdsByGeoNear).toHaveBeenCalledWith(
      127.1,
      37.5,
      3000,
    );
    expect(cakeReader.findInStoresByCursor).toHaveBeenCalledTimes(1);
    expect(cakeReader.findInStoresByCursor).toHaveBeenCalledWith(
      ['store-1'],
      'cursor-0',
      3,
    );
    expect(result).toMatchObject({ hasMore: true });
    expect(result.cakes).toHaveLength(2);
  });

  it('keeps hasMore false at the exact location cake limit', async () => {
    const storeReader = {
      findIdsByGeoNear: jest.fn().mockResolvedValue(['store-1']),
    };
    const cakeReader = {
      findInStoresAfterId: jest.fn().mockResolvedValue([cake('1'), cake('2')]),
    };
    const service = buildService(cakeReader, storeReader);

    const result = await service.findAllCakesByLocation(
      37.5,
      127.1,
      3000,
      'after-id',
      2,
    );

    expect(storeReader.findIdsByGeoNear).toHaveBeenCalledTimes(1);
    expect(cakeReader.findInStoresAfterId).toHaveBeenCalledTimes(1);
    expect(cakeReader.findInStoresAfterId).toHaveBeenCalledWith(
      ['store-1'],
      'after-id',
      3,
    );
    expect(result).toMatchObject({ hasMore: false });
    expect(result.cakes).toHaveLength(2);
  });

  it('checks store existence once and paginates store cakes', async () => {
    const storeReader = {
      ensureExists: jest.fn().mockResolvedValue(undefined),
    };
    const cakeReader = {
      findByStoreIdAfter: jest
        .fn()
        .mockResolvedValue([cake('1'), cake('2'), cake('3')]),
    };
    const service = buildService(cakeReader, storeReader);

    const result = await service.findStoreCakes('store-1', 'after-id', 2);

    expect(storeReader.ensureExists).toHaveBeenCalledTimes(1);
    expect(storeReader.ensureExists).toHaveBeenCalledWith('store-1');
    expect(cakeReader.findByStoreIdAfter).toHaveBeenCalledTimes(1);
    expect(cakeReader.findByStoreIdAfter).toHaveBeenCalledWith(
      'store-1',
      'after-id',
      3,
    );
    expect(result.hasMore).toBe(true);
    expect(result.cakes).toHaveLength(2);
  });

  it('loads recent cakes in one batch after slicing the store page', async () => {
    const stores = [store('store-1'), store('store-2'), store('store-3')];
    const storeReader = {
      findByGeoNear: jest.fn().mockResolvedValue(stores),
    };
    const cakeReader = {
      findRecentByStoreIds: jest.fn().mockResolvedValue(
        new Map([
          ['store-1', [cake('cake-1', 'store-1')]],
          ['store-2', [cake('cake-2', 'store-2')]],
        ]),
      ),
    };
    const service = buildService(cakeReader, storeReader);

    const result = await service.findAllStores(37.5, 127.1, 3000, 0, 2);

    expect(storeReader.findByGeoNear).toHaveBeenCalledTimes(1);
    expect(storeReader.findByGeoNear).toHaveBeenCalledWith(
      127.1,
      37.5,
      3000,
      0,
      3,
    );
    expect(cakeReader.findRecentByStoreIds).toHaveBeenCalledTimes(1);
    expect(cakeReader.findRecentByStoreIds).toHaveBeenCalledWith([
      'store-1',
      'store-2',
    ]);
    expect(result.hasMore).toBe(true);
    expect(result.stores).toHaveLength(2);
    expect(result.cakesByStoreId.get('store-1')).toHaveLength(1);
  });

  it('keeps an empty store page and one empty batch boundary call', async () => {
    const storeReader = { findByGeoNear: jest.fn().mockResolvedValue([]) };
    const cakeReader = {
      findRecentByStoreIds: jest.fn().mockResolvedValue(new Map()),
    };
    const service = buildService(cakeReader, storeReader);

    const result = await service.findAllStores(37.5, 127.1, 3000, 0, 20);

    expect(cakeReader.findRecentByStoreIds).toHaveBeenCalledTimes(1);
    expect(cakeReader.findRecentByStoreIds).toHaveBeenCalledWith([]);
    expect(result).toMatchObject({ stores: [], hasMore: false });
  });
});
