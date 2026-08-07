import { UserService } from './user.service';
import { UnauthorizedException } from '@nestjs/common';

describe('UserService', () => {
  it('updates only the profile fields explicitly allowed by the DTO', async () => {
    const userRepository = {
      findByFirebaseUidOrThrow: jest.fn().mockResolvedValue({
        firebaseUid: 'user-1',
      }),
      update: jest.fn().mockResolvedValue({ acknowledged: true }),
    };
    const tokenVerifier = { verify: jest.fn() };
    const service = new UserService(
      userRepository as never,
      tokenVerifier as never,
    );
    const input = {
      nickname: 'updated',
      roles: ['ADMIN'],
    } as never;

    await service.changeContent('user-1', input);

    expect(userRepository.update).toHaveBeenCalledWith('user-1', {
      nickname: 'updated',
    });
  });

  it('registers a user from the verified user contract', async () => {
    const userRepository = {
      findByFirebaseUid: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ firebaseUid: 'firebase-user-1' }),
    };
    const tokenVerifier = {
      verify: jest.fn().mockResolvedValue({
        uid: 'firebase-user-1',
        signInProvider: 'google.com',
      }),
    };
    const service = new UserService(
      userRepository as never,
      tokenVerifier as never,
    );

    await service.create({ token: 'Bearer valid-token', nickname: 'user' });

    expect(tokenVerifier.verify).toHaveBeenCalledWith('valid-token');
    expect(userRepository.create).toHaveBeenCalledWith({
      firebaseUid: 'firebase-user-1',
      nickname: 'user',
      oauthProvider: 'google.com',
    });
  });

  it('maps verifier failures to the existing 401 boundary', async () => {
    const tokenVerifier = {
      verify: jest.fn().mockRejectedValue(new Error('invalid token')),
    };
    const service = new UserService({} as never, tokenVerifier as never);

    await expect(
      service.create({ token: 'Bearer invalid-token', nickname: 'user' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
