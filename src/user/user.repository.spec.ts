import { UserNotFoundException } from './exceptions/user-not-found';
import { UserRepository } from './user.repository';

describe('UserRepository', () => {
  describe('findByFirebaseUidOrThrow', () => {
    it('returns user found by firebaseUid', async () => {
      const user = { firebaseUid: 'user-1' };
      const userModel = {
        findOne: jest.fn().mockResolvedValue(user),
      };
      const repo = new UserRepository(userModel as any);

      await expect(repo.findByFirebaseUidOrThrow('user-1')).resolves.toBe(
        user,
      );
      expect(userModel.findOne).toHaveBeenCalledWith({
        firebaseUid: 'user-1',
      });
    });

    it('throws UserNotFoundException when user is not found', async () => {
      const userModel = {
        findOne: jest.fn().mockResolvedValue(null),
      };
      const repo = new UserRepository(userModel as any);

      await expect(repo.findByFirebaseUidOrThrow('missing')).rejects.toBeInstanceOf(
        UserNotFoundException,
      );
    });
  });

  it('adds cake like to user', async () => {
    const userModel = { updateOne: jest.fn().mockResolvedValue({}) };
    const repo = new UserRepository(userModel as any);

    await repo.addCakeLike('user-1', 'cake-1');

    expect(userModel.updateOne).toHaveBeenCalledWith(
      { firebaseUid: 'user-1' },
      { $addToSet: { cake_like_ids: ['cake-1'] } },
    );
  });

  it('removes cake like from user', async () => {
    const userModel = { updateOne: jest.fn().mockResolvedValue({}) };
    const repo = new UserRepository(userModel as any);

    await repo.removeCakeLike('user-1', 'cake-1');

    expect(userModel.updateOne).toHaveBeenCalledWith(
      { firebaseUid: 'user-1' },
      { $pull: { cake_like_ids: 'cake-1' } },
    );
  });

  it('adds store like to user', async () => {
    const userModel = { updateOne: jest.fn().mockResolvedValue({}) };
    const repo = new UserRepository(userModel as any);

    await repo.addStoreLike('user-1', 'store-1');

    expect(userModel.updateOne).toHaveBeenCalledWith(
      { firebaseUid: 'user-1' },
      { $addToSet: { store_like_ids: ['store-1'] } },
    );
  });

  it('removes store like from user', async () => {
    const userModel = { updateOne: jest.fn().mockResolvedValue({}) };
    const repo = new UserRepository(userModel as any);

    await repo.removeStoreLike('user-1', 'store-1');

    expect(userModel.updateOne).toHaveBeenCalledWith(
      { firebaseUid: 'user-1' },
      { $pull: { store_like_ids: 'store-1' } },
    );
  });
});
