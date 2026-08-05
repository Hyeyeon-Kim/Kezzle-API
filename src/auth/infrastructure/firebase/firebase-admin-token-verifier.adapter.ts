import { Inject, Injectable } from '@nestjs/common';
import { DecodedIdToken } from 'firebase-admin/auth';
import { FirebaseTokenVerifier } from 'src/auth/application/firebase-token-verifier.port';
import { TokenVerificationError } from 'src/auth/application/token-verification.error';
import { VerifiedUser } from 'src/auth/application/verified-user';
import { FIREBASE_AUTH_CLIENT } from './firebase.constants';

export interface FirebaseAuthClient {
  verifyIdToken(token: string, checkRevoked?: boolean): Promise<DecodedIdToken>;
}

@Injectable()
export class FirebaseAdminTokenVerifierAdapter
  implements FirebaseTokenVerifier
{
  constructor(
    @Inject(FIREBASE_AUTH_CLIENT)
    private readonly firebaseAuth: FirebaseAuthClient,
  ) {}

  async verify(token: string): Promise<VerifiedUser> {
    try {
      const decoded = await this.firebaseAuth.verifyIdToken(token, true);
      return {
        uid: decoded.uid,
        signInProvider: decoded.firebase?.sign_in_provider ?? 'unknown',
      };
    } catch (error) {
      const code = this.errorCode(error);
      throw new TokenVerificationError(code, this.errorMessage(error), error);
    }
  }

  private errorCode(error: unknown): string {
    return typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : 'auth/token-verification-failed';
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string'
      ? error.message
      : 'Invalid Firebase ID token';
  }
}
