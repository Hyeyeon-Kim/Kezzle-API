import { AuthenticatedUser } from 'src/platform/auth/authenticated-user';

export abstract class AuthenticatedUserReader {
  abstract findAuthenticatedUser(
    firebaseUid: string,
  ): Promise<AuthenticatedUser>;
}
