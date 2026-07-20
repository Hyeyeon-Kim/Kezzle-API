import { CreateUserData, UpdateUserData } from './application/user.command';
import { UserView } from './application/user.view';

export class UserPersistenceMapper {
  static toView(source: any): UserView {
    return {
      id: source?._id?.toString() ?? source?.id?.toString(),
      firebaseUid: source?.firebaseUid,
      nickname: source?.nickname ?? null,
      oauthProvider: source?.oauth_provider,
      roles: [...(source?.roles ?? [])],
      cakeLikeIds: [...(source?.cake_like_ids ?? [])],
      storeLikeIds: [...(source?.store_like_ids ?? [])],
      createdAt: source?.createdAt,
      updatedAt: source?.updatedAt,
    };
  }

  static toCreatePersistence(data: CreateUserData) {
    return {
      firebaseUid: data.firebaseUid,
      nickname: data.nickname,
      oauth_provider: data.oauthProvider,
    };
  }

  static toUpdatePersistence(data: UpdateUserData) {
    return { nickname: data.nickname };
  }
}
