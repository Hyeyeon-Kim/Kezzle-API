import { Roles } from 'src/user/domain/roles.enum';

export interface AuthenticatedUser {
  readonly firebaseUid: string;
  readonly nickname: string;
  readonly oauthProvider: string;
  readonly roles: Roles[];
  readonly cakeLikeIds: string[];
  readonly storeLikeIds: string[];
}
