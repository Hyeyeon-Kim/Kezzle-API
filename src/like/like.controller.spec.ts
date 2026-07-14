import { ForbiddenException } from '@nestjs/common';
import { Roles } from 'src/user/entities/roles.enum';
import { LikeController } from './like.controller';

describe('LikeController ownership', () => {
  it('rejects another user liked-cake list', () => {
    const likeService = { findUserLikeCake: jest.fn() };
    const controller = new LikeController(likeService as never);
    const user = {
      firebaseUid: 'user-1',
      nickname: 'user',
      oauth_provider: 'firebase',
      roles: [Roles.BUYER],
      cake_like_ids: [],
      store_like_ids: [],
    };

    expect(() => controller.getCake('user-2', user)).toThrow(
      ForbiddenException,
    );
    expect(likeService.findUserLikeCake).not.toHaveBeenCalled();
  });
});
