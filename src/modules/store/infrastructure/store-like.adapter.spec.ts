import { StoreNotFoundException } from '../application/exceptions/store-not-found.exception';
import { StoreLikeRepositoryAdapter } from './store-like.adapter';

describe('StoreLikeRepositoryAdapter', () => {
  it('maps Store documents to pure Like views', async () => {
    const adapter = new StoreLikeRepositoryAdapter({
      findByUserLike: jest.fn().mockResolvedValue([
        {
          id: 'store-1',
          name: 'Store 1',
          logo: {},
          address: 'Seoul',
          likedUserIds: ['user-1'],
        },
      ]),
    } as any);

    await expect(adapter.findByUserLike('user-1')).resolves.toEqual([
      {
        id: 'store-1',
        name: 'Store 1',
        logo: {},
        address: 'Seoul',
        likedUserIds: ['user-1'],
      },
    ]);
  });

  it('preserves StoreNotFoundException from the repository', async () => {
    const error = new StoreNotFoundException('missing-store');
    const adapter = new StoreLikeRepositoryAdapter({
      findByIdOrThrow: jest.fn().mockRejectedValue(error),
    } as any);

    await expect(adapter.findTargetOrThrow('missing-store')).rejects.toBe(
      error,
    );
  });
});
