import { StoreCakeWriteContextRepositoryAdapter } from './store-cake-write-context.adapter';

describe('StoreCakeWriteContextRepositoryAdapter', () => {
  it('maps a pure Store view to the minimal write context', async () => {
    const storeRepository = {
      findByIdOrThrow: jest.fn().mockResolvedValue({
        id: 'store-1',
        ownerUserId: 'owner-1',
        name: 'Store Name',
        address: 'not exposed',
      }),
    };
    const adapter = new StoreCakeWriteContextRepositoryAdapter(
      storeRepository as any,
    );

    await expect(adapter.findByIdOrThrow('store-1')).resolves.toEqual({
      storeId: 'store-1',
      ownerUserId: 'owner-1',
      storeName: 'Store Name',
    });
    expect(storeRepository.findByIdOrThrow).toHaveBeenCalledWith('store-1');
  });
});
