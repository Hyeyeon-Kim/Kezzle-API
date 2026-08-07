import fixtures from '../../../../../test/fixtures/legacy-persistence.contract.json';
import { Roles } from 'src/platform/auth/roles.enum';
import { CreateUserResponseDto } from 'src/modules/user/api/dto/response/create-user-response.dto';
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

  it('keeps the create-user API response on legacy keys', () => {
    const response = new CreateUserResponseDto(
      UserPersistenceMapper.toView(fixtures.user),
    );

    expect(response).toMatchObject({
      _id: '65a000000000000000000003',
      firebaseUid: 'legacy-user-1',
      oauth_provider: 'password',
      roles: [Roles.SELLER, Roles.BUYER],
      cake_like_ids: ['cake-1'],
      store_like_ids: [],
    });
    expect(response).not.toHaveProperty('oauthProvider');
  });
});
