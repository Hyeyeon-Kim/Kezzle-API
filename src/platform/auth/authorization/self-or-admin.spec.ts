import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from 'src/platform/auth/authenticated-user';
import { Roles } from 'src/platform/auth/roles.enum';
import { assertSelfOrAdmin } from './self-or-admin';

describe('assertSelfOrAdmin', () => {
  const user: AuthenticatedUser = {
    firebaseUid: 'user-1',
    nickname: 'user',
    oauthProvider: 'firebase',
    roles: [Roles.BUYER],
    cakeLikeIds: [],
    storeLikeIds: [],
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
