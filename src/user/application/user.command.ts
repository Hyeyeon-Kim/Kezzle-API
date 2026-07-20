export interface CreateUserData {
  readonly firebaseUid: string;
  readonly nickname: string;
  readonly oauthProvider: string;
}

export interface UpdateUserData {
  readonly nickname: string;
}
