import { UserNotFoundException } from '../application/exceptions/user-not-found';
import { UserLikeRepositoryAdapter } from './user-like.adapter';

describe('UserLikeRepositoryAdapter', () => {
  it('maps a User document to the pure Like view', async () => {
    const adapter = new UserLikeRepositoryAdapter({
      findByFirebaseUidOrThrow: jest.fn().mockResolvedValue({
        firebaseUid: 'user-1',
        cakeLikeIds: ['cake-1'],
        storeLikeIds: ['store-1'],
      }),
    } as any);

    await expect(adapter.findByFirebaseUidOrThrow('user-1')).resolves.toEqual({
      firebaseUid: 'user-1',
      cakeLikeIds: ['cake-1'],
      storeLikeIds: ['store-1'],
    });
  });

  it('preserves UserNotFoundException from the repository', async () => {
    const error = new UserNotFoundException('missing-user');
    const adapter = new UserLikeRepositoryAdapter({
      findByFirebaseUidOrThrow: jest.fn().mockRejectedValue(error),
    } as any);

    await expect(adapter.findByFirebaseUidOrThrow('missing-user')).rejects.toBe(
      error,
    );
  });
});
