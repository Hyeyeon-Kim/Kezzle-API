import {
  CreateUserData,
  UpdateUserData,
} from 'src/modules/user/application/user.command';
import { UserView } from 'src/modules/user/application/user.view';
import { Roles } from 'src/platform/auth/roles.enum';

interface UserPersistenceSource {
  readonly _id?: unknown;
  readonly id?: unknown;
  readonly firebaseUid?: string;
  readonly nickname?: string | null;
  readonly oauth_provider?: string;
  readonly roles?: string[];
  readonly cake_like_ids?: string[];
  readonly store_like_ids?: string[];
  readonly createdAt?: Date | string;
  readonly updatedAt?: Date | string;
}

function identifier(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

function dateValue(value: Date | string | undefined): Date | undefined {
  return typeof value === 'string' ? new Date(value) : value;
}

function roleValues(values: string[] = []): Roles[] {
  const allowed = new Set<string>(Object.values(Roles));
  if (values.some((value) => !allowed.has(value))) {
    throw new TypeError('Invalid persisted User role');
  }
  return [...values] as Roles[];
}

export class UserPersistenceMapper {
  static toView(source: UserPersistenceSource): UserView {
    return {
      id: identifier(source?._id) ?? identifier(source?.id),
      firebaseUid: source?.firebaseUid,
      nickname: source?.nickname ?? null,
      oauthProvider: source?.oauth_provider,
      roles: roleValues(source?.roles),
      cakeLikeIds: [...(source?.cake_like_ids ?? [])],
      storeLikeIds: [...(source?.store_like_ids ?? [])],
      createdAt: dateValue(source?.createdAt),
      updatedAt: dateValue(source?.updatedAt),
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
