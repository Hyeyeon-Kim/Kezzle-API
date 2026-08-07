import {
  Controller,
  Get,
  INestApplication,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { FirebaseTokenVerifier } from 'src/auth/application/firebase-token-verifier.port';
import { TokenVerificationError } from 'src/auth/application/token-verification.error';
import { FirebaseAuthStrategy } from 'src/auth/stategies/firebase-auth.stategies';
import { UserService } from 'src/user/application/user.service';

@Controller('firebase-auth-contract')
class FirebaseAuthContractController {
  @Get()
  @UseGuards(AuthGuard('firebase-auth'))
  getVerifiedUser(@Req() request: { user?: unknown }) {
    return request.user;
  }
}

describe('Firebase verifier HTTP contract (e2e)', () => {
  let app: INestApplication;
  const verifier = { verify: jest.fn() };
  const userService = { findAuthenticatedUser: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [FirebaseAuthContractController],
      providers: [
        FirebaseAuthStrategy,
        { provide: FirebaseTokenVerifier, useValue: verifier },
        { provide: UserService, useValue: userService },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    verifier.verify.mockReset();
    userService.findAuthenticatedUser.mockReset();
  });

  afterAll(async () => app.close());

  it('authenticates with a fake verifier without Firebase credentials or network', async () => {
    verifier.verify.mockResolvedValue({
      uid: 'firebase-user-1',
      signInProvider: 'google.com',
    });
    userService.findAuthenticatedUser.mockResolvedValue({
      firebaseUid: 'firebase-user-1',
      nickname: 'verified',
      oauthProvider: 'google.com',
      roles: ['BUYER'],
      cakeLikeIds: [],
      storeLikeIds: [],
    });

    await request(app.getHttpServer())
      .get('/firebase-auth-contract')
      .set('Authorization', 'Bearer valid-token')
      .expect(200)
      .expect(({ body }) => {
        expect(body.firebaseUid).toBe('firebase-user-1');
      });

    expect(verifier.verify).toHaveBeenCalledWith('valid-token');
  });

  it.each([
    ['invalid token', 'auth/argument-error'],
    ['revoked token', 'auth/id-token-revoked'],
  ])('maps %s verifier failures to 401', async (message, code) => {
    verifier.verify.mockRejectedValue(
      new TokenVerificationError(code, message),
    );

    await request(app.getHttpServer())
      .get('/firebase-auth-contract')
      .set('Authorization', `Bearer ${code}`)
      .expect(401)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(401);
        expect(body.message).toBe(message);
      });
    expect(userService.findAuthenticatedUser).not.toHaveBeenCalled();
  });
});
