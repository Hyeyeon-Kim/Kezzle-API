import { UnauthorizedException } from '@nestjs/common';
import { FirebaseTokenVerifier } from './firebase-token-verifier.port';
import { VerifiedUser } from './verified-user';

export async function verifyTokenOrThrowUnauthorized(
  verifier: FirebaseTokenVerifier,
  token: string,
): Promise<VerifiedUser> {
  try {
    return await verifier.verify(token);
  } catch (error) {
    throw new UnauthorizedException(
      error instanceof Error ? error.message : 'Invalid authentication token',
    );
  }
}
