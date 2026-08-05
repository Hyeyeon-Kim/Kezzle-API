import fixtures from '../../../../../test/fixtures/legacy-persistence.contract.json';
import { Roles } from '../../application/roles.enum';
import { UserPersistenceMapper } from './user.persistence-mapper';

describe('UserPersistenceMapper', () => {
  it('maps a legacy persistence record to a pure User view', () => {
    expect(UserPersistenceMapper.toView(fixtures.user)).toMatchObject({
      id: '65a000000000000000000003',
      firebaseUid: 'legacy-user-1',
      nickname: 'legacy user',
      oauthProvider: 'password',
      roles: [Roles.SELLER, Roles.BUYER],
      cakeLikeIds: ['cake-1'],
      storeLikeIds: [],
    });
  });

  it('maps pure write data to legacy persistence keys', () => {
    expect(
      UserPersistenceMapper.toCreatePersistence({
        firebaseUid: 'user-1',
        nickname: 'user',
        oauthProvider: 'password',
      }),
    ).toEqual({
      firebaseUid: 'user-1',
      nickname: 'user',
      oauth_provider: 'password',
    });
    expect(
      UserPersistenceMapper.toUpdatePersistence({ nickname: 'updated' }),
    ).toEqual({ nickname: 'updated' });
  });
});
