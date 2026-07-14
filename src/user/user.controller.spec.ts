import { ForbiddenException } from '@nestjs/common';
import { Roles } from './entities/roles.enum';
import { UserController } from './user.controller';

describe('UserController ownership', () => {
  const user = {
    firebaseUid: 'user-1',
    nickname: 'user',
    oauth_provider: 'firebase',
    roles: [Roles.BUYER],
    cake_like_ids: [],
    store_like_ids: [],
  };

  function createController() {
    const service = {
      findOneByFirebase: jest.fn(),
      changeContent: jest.fn(),
      removeContent: jest.fn(),
    };
    return { controller: new UserController(service as never), service };
  }

  it('rejects another user profile before querying it', () => {
    const { controller, service } = createController();

    expect(() => controller.getOne('user-2', user)).toThrow(ForbiddenException);
    expect(service.findOneByFirebase).not.toHaveBeenCalled();
  });

  it('allows an admin to query another user profile', () => {
    const { controller, service } = createController();

    controller.getOne('user-2', { ...user, roles: [Roles.ADMIN] });

    expect(service.findOneByFirebase).toHaveBeenCalledWith('user-2');
  });
});
