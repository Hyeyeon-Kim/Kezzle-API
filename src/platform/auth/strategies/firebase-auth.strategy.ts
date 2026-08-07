import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { Strategy, ExtractJwt } from 'passport-firebase-jwt';
import { AuthenticatedUserReader } from '../application/authenticated-user.reader';
import { FirebaseTokenVerifier } from '../application/firebase-token-verifier.port';
import { verifyTokenOrThrowUnauthorized } from '../application/verify-token';

@Injectable()
export class FirebaseAuthStrategy extends PassportStrategy(
  Strategy,
  'firebase-auth',
) {
  constructor(
    private readonly authenticatedUserReader: AuthenticatedUserReader,
    private readonly tokenVerifier: FirebaseTokenVerifier,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  async validate(token: string) {
    const verifiedUser = await verifyTokenOrThrowUnauthorized(
      this.tokenVerifier,
      token,
    );
    return this.authenticatedUserReader.findAuthenticatedUser(verifiedUser.uid);
  }
}
