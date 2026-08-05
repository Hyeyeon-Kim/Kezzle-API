import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { Strategy, ExtractJwt } from 'passport-firebase-jwt';
import { UserService } from 'src/modules/user/user.service';
import { FirebaseTokenVerifier } from '../application/firebase-token-verifier.port';
import { verifyTokenOrThrowUnauthorized } from '../application/verify-token';

@Injectable()
export class FirebaseAuthStrategy extends PassportStrategy(
  Strategy,
  'firebase-auth',
) {
  constructor(
    private readonly userservice: UserService,
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
    return this.userservice.findAuthenticatedUser(verifiedUser.uid);
  }
}
