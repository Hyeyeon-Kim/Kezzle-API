import { Injectable } from '@nestjs/common';
import { FirebaseTokenVerifier } from 'src/platform/auth/application/firebase-token-verifier.port';
import { verifyTokenOrThrowUnauthorized } from 'src/platform/auth/application/verify-token';
import { AuthenticatedUser } from 'src/platform/auth/authenticated-user';
import { AuthenticatedUserReader } from 'src/platform/auth/application/authenticated-user.reader';
import { UserView } from 'src/modules/user/application/user.view';
import {
  RegisterUserCommand,
  UpdateUserData,
} from 'src/modules/user/application/user.command';
import { UserAlreadyJoinedException } from 'src/modules/user/application/exception/user-already-joined.exception';
import { UserRepositoryPort } from './port/user-repository.port';

@Injectable()
export class UserService implements AuthenticatedUserReader {
  constructor(
    private readonly userRepository: UserRepositoryPort,
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
      throw new UserAlreadyJoinedException(verifiedUser.uid);
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
