import { StoreCatalogRepositoryAdapter } from './store-catalog.adapter';

describe('StoreCatalogRepositoryAdapter', () => {
  it('loads projected store summaries once and maps them to pure views', async () => {
    const storeRepository = {
      findByIdsWithProjection: jest.fn().mockResolvedValue([
        {
          _id: { toString: () => 'store-1' },
          name: 'Store 1',
          address: 'Seoul',
          taste: ['vanilla'],
          location: { coordinates: [127.1, 37.5] },
        },
      ]),
    };
    const adapter = new StoreCatalogRepositoryAdapter(storeRepository as any);

    const result = await adapter.findSummariesByIds(['store-1']);

    expect(storeRepository.findByIdsWithProjection).toHaveBeenCalledTimes(1);
    expect(storeRepository.findByIdsWithProjection).toHaveBeenCalledWith(
      ['store-1'],
      { name: 1, address: 1, taste: 1, location: 1 },
    );
    expect(result).toEqual([
      {
        id: 'store-1',
        name: 'Store 1',
        address: 'Seoul',
        taste: ['vanilla'],
        longitude: 127.1,
        latitude: 37.5,
      },
    ]);
  });
});
