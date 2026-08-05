import { Injectable } from '@nestjs/common';
import { FirebaseTokenVerifier } from 'src/platform/auth/application/firebase-token-verifier.port';
import { verifyTokenOrThrowUnauthorized } from 'src/platform/auth/application/verify-token';
import { AuthenticatedUser } from './authenticated-user';
import { UserView } from './user.view';
import { RegisterUserCommand, UpdateUserData } from './user.command';
import { UserAlredyJoinedException } from './exceptions/user-already-joined.exception';
import { UserRepository } from '../infrastructure/persistence/user.repository';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenVerifier: FirebaseTokenVerifier,
  ) {}

  async create(command: RegisterUserCommand): Promise<UserView> {
    const token = command.token.replace('Bearer ', '');
    const verifiedUser = await verifyTokenOrThrowUnauthorized(
      this.tokenVerifier,
      token,
    );

    const existing = await this.userRepository.findByFirebaseUid(
      verifiedUser.uid,
    );
    if (existing) {
      throw new UserAlredyJoinedException(verifiedUser.uid);
    }

    return this.userRepository.create({
      nickname: command.nickname,
      firebaseUid: verifiedUser.uid,
      oauthProvider: verifiedUser.signInProvider,
    });
  }

  async findAll(): Promise<UserView[]> {
    return this.userRepository.findAll();
  }

  async findOneByFirebase(firebaseUid: string): Promise<UserView> {
    return this.userRepository.findByFirebaseUidOrThrow(firebaseUid);
  }

  async findAuthenticatedUser(firebaseUid: string): Promise<AuthenticatedUser> {
    const user =
      await this.userRepository.findByFirebaseUidOrThrow(firebaseUid);
    return {
      firebaseUid: user.firebaseUid,
      nickname: user.nickname,
      oauthProvider: user.oauthProvider,
      roles: [...user.roles],
      cakeLikeIds: [...user.cakeLikeIds],
      storeLikeIds: [...user.storeLikeIds],
    };
  }

  async changeContent(firebaseUid: string, updateData: UpdateUserData) {
    await this.userRepository.findByFirebaseUidOrThrow(firebaseUid);
    return this.userRepository.update(firebaseUid, {
      nickname: updateData.nickname,
    });
  }

  async removeContent(firebaseUid: string) {
    await this.userRepository.findByFirebaseUidOrThrow(firebaseUid);
    return this.userRepository.delete(firebaseUid);
  }
}
