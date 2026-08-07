import { LikedStoreCatalogAdapter } from './liked-store-catalog.adapter';

const store = (id: string) => ({
  id,
  name: `Store ${id}`,
  logo: {},
  address: 'Seoul',
  likedUserIds: ['target-user'],
});

const cake = (id: string, storeId: string) => ({
  id,
  image: {},
  ownerStoreId: storeId,
  likedUserIds: [],
  cursor: `cursor-${id}`,
  tags: [],
});

describe('LikedStoreCatalogAdapter', () => {
  it('loads liked stores and recent cakes with one batch call', async () => {
    const storeLikePort = {
      findByUserLike: jest
        .fn()
        .mockResolvedValue([store('store-1'), store('store-2')]),
    };
    const cakeReader = {
      findRecentByStoreIds: jest.fn().mockResolvedValue(
        new Map([
          ['store-1', [cake('cake-1', 'store-1')]],
          ['store-2', [cake('cake-2', 'store-2')]],
        ]),
      ),
    };
    const adapter = new LikedStoreCatalogAdapter(
      storeLikePort as any,
      cakeReader as any,
    );

    const result = await adapter.findByUserLike('target-user');

    expect(storeLikePort.findByUserLike).toHaveBeenCalledTimes(1);
    expect(cakeReader.findRecentByStoreIds).toHaveBeenCalledTimes(1);
    expect(cakeReader.findRecentByStoreIds).toHaveBeenCalledWith([
      'store-1',
      'store-2',
    ]);
    expect(result[0].cakes).toHaveLength(1);
    expect(result[1].cakes).toHaveLength(1);
  });

  it('keeps stores whose cake hydration is missing', async () => {
    const adapter = new LikedStoreCatalogAdapter(
      {
        findByUserLike: jest
          .fn()
          .mockResolvedValue([store('store-1'), store('store-2')]),
      } as any,
      {
        findRecentByStoreIds: jest
          .fn()
          .mockResolvedValue(
            new Map([['store-1', [cake('cake-1', 'store-1')]]]),
          ),
      } as any,
    );

    const result = await adapter.findByUserLike('target-user');

    expect(result).toHaveLength(2);
    expect(result[1].cakes).toEqual([]);
  });

  it('keeps one empty batch boundary call', async () => {
    const cakeReader = {
      findRecentByStoreIds: jest.fn().mockResolvedValue(new Map()),
    };
    const adapter = new LikedStoreCatalogAdapter(
      { findByUserLike: jest.fn().mockResolvedValue([]) } as any,
      cakeReader as any,
    );

    await expect(adapter.findByUserLike('target-user')).resolves.toEqual([]);
    expect(cakeReader.findRecentByStoreIds).toHaveBeenCalledTimes(1);
    expect(cakeReader.findRecentByStoreIds).toHaveBeenCalledWith([]);
  });
});
