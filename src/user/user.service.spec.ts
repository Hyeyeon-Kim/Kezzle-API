import { UserService } from './user.service';

describe('UserService', () => {
  it('updates only the profile fields explicitly allowed by the DTO', async () => {
    const userRepository = {
      findByFirebaseUidOrThrow: jest.fn().mockResolvedValue({
        firebaseUid: 'user-1',
      }),
      update: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const service = new UserService(userRepository as never);
    const input = {
      nickname: 'updated',
      roles: ['ADMIN'],
    } as never;

    await service.changeContent('user-1', input);

    expect(userRepository.update).toHaveBeenCalledWith('user-1', {
      nickname: 'updated',
    });
  });
});
