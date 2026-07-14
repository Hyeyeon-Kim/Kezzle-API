import { ForbiddenException } from '@nestjs/common';
import { Roles } from 'src/user/entities/roles.enum';
import IUser from 'src/user/interfaces/user.interface';
import { assertSelfOrAdmin } from './self-or-admin';

describe('assertSelfOrAdmin', () => {
  const user: IUser = {
    firebaseUid: 'user-1',
    nickname: 'user',
    oauth_provider: 'firebase',
    roles: [Roles.BUYER],
    cake_like_ids: [],
    store_like_ids: [],
  };

  it('allows a user to access their own resource', () => {
    expect(() => assertSelfOrAdmin(user, 'user-1')).not.toThrow();
  });

  it('allows an admin to access another user resource', () => {
    expect(() =>
      assertSelfOrAdmin({ ...user, roles: [Roles.ADMIN] }, 'user-2'),
    ).not.toThrow();
  });

  it('rejects another user resource', () => {
    expect(() => assertSelfOrAdmin(user, 'user-2')).toThrow(ForbiddenException);
  });
});
