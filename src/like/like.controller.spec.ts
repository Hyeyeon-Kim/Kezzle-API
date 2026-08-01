import { ForbiddenException } from '@nestjs/common';
import { Roles } from 'src/user/entities/roles.enum';
import { LikeController } from './like.controller';
import { LikePresenter } from './api/like.presenter';

describe('LikeController ownership', () => {
  it('rejects another user liked-cake list', () => {
    const likeService = { findUserLikeCake: jest.fn() };
    const controller = new LikeController(
      likeService as never,
      new LikePresenter(),
    );
    const user = {
      firebaseUid: 'user-1',
      nickname: 'user',
      oauthProvider: 'firebase',
      roles: [Roles.BUYER],
      cakeLikeIds: [],
      storeLikeIds: [],
    };

    expect(() => controller.getCake('user-2', user)).toThrow(
      ForbiddenException,
    );
    expect(likeService.findUserLikeCake).not.toHaveBeenCalled();
  });
});
