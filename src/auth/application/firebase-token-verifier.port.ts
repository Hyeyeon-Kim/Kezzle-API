import { VerifiedUser } from './verified-user';

export abstract class FirebaseTokenVerifier {
  abstract verify(token: string): Promise<VerifiedUser>;
}
