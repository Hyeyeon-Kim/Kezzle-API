import { CakeCatalogRepositoryAdapter } from './cake-catalog.adapter';

describe('CakeCatalogRepositoryAdapter', () => {
  it('maps repository documents to pure views while preserving one batch call', async () => {
    const cakeRepository = {
      findRecentByStoreIds: jest.fn().mockResolvedValue(
        new Map([
          [
            'store-1',
            [
              {
                id: 'cake-1',
                image: { s3Url: 'cake.jpg' },
                ownerStoreId: 'store-1',
                likedUserIds: ['user-1'],
                cursor: 'cursor-1',
                tags: ['vanilla'],
              },
            ],
          ],
        ]),
      ),
    };
    const adapter = new CakeCatalogRepositoryAdapter(cakeRepository as any);

    const result = await adapter.findRecentByStoreIds(['store-1']);

    expect(cakeRepository.findRecentByStoreIds).toHaveBeenCalledTimes(1);
    expect(result.get('store-1')).toEqual([
      {
        id: 'cake-1',
        image: { s3Url: 'cake.jpg' },
        ownerStoreId: 'store-1',
        likedUserIds: ['user-1'],
        cursor: 'cursor-1',
        tags: ['vanilla'],
      },
    ]);
  });
});
