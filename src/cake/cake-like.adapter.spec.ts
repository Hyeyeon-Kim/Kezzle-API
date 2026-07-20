import { CakeNotFoundException } from './exceptions/cake-not-found.exception';
import { CakeLikeRepositoryAdapter } from './cake-like.adapter';

describe('CakeLikeRepositoryAdapter', () => {
  it('maps Cake documents to pure Like views', async () => {
    const cakeRepository = {
      findByIds: jest.fn().mockResolvedValue([
        {
          id: 'cake-1',
          image: {},
          ownerStoreId: 'store-1',
          likedUserIds: ['user-1'],
          cursor: 'cursor-1',
          tags: ['vanilla'],
        },
      ]),
    };
    const adapter = new CakeLikeRepositoryAdapter(cakeRepository as any);

    await expect(adapter.findByIds(['cake-1'])).resolves.toEqual([
      {
        id: 'cake-1',
        image: {},
        ownerStoreId: 'store-1',
        likedUserIds: ['user-1'],
        cursor: 'cursor-1',
        tags: ['vanilla'],
      },
    ]);
  });

  it('preserves CakeNotFoundException from the repository', async () => {
    const error = new CakeNotFoundException('missing-cake');
    const adapter = new CakeLikeRepositoryAdapter({
      findByIdOrThrow: jest.fn().mockRejectedValue(error),
    } as any);

    await expect(adapter.findTargetOrThrow('missing-cake')).rejects.toBe(error);
  });
});
