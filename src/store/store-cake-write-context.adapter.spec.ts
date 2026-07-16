import { StoreCakeWriteContextRepositoryAdapter } from './store-cake-write-context.adapter';

describe('StoreCakeWriteContextRepositoryAdapter', () => {
  it('maps a Store document to the minimal pure write context', async () => {
    const storeRepository = {
      findByIdOrThrow: jest.fn().mockResolvedValue({
        _id: { toString: () => 'store-1' },
        owner_user_id: 'owner-1',
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
