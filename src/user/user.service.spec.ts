import { UserService } from './user.service';

describe('UserService', () => {
  it('updates only the profile fields explicitly allowed by the DTO', async () => {
    const userModel = {
      findOne: jest.fn().mockResolvedValue({ firebaseUid: 'user-1' }),
      updateOne: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const service = new UserService(userModel as never);
    const input = {
      nickname: 'updated',
      roles: ['ADMIN'],
    } as never;

    await service.changeContent('user-1', input);

    expect(userModel.updateOne).toHaveBeenCalledWith(
      { firebaseUid: 'user-1' },
      { $set: { nickname: 'updated' } },
    );
  });
});
