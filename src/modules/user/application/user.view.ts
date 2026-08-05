import { Roles } from '../entities/roles.enum';

export interface UserView {
  readonly id?: string;
  readonly firebaseUid: string;
  readonly nickname: string | null;
  readonly oauthProvider: string;
  readonly roles: Roles[];
  readonly cakeLikeIds: string[];
  readonly storeLikeIds: string[];
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}
