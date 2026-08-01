import { Injectable, UnauthorizedException } from '@nestjs/common';
import { auth } from 'firebase-admin';
import { AuthenticatedUser } from './application/authenticated-user';
import { UserView } from './application/user.view';
import {
  RegisterUserCommand,
  UpdateUserData,
} from './application/user.command';
import { UserAlredyJoinedException } from './exceptions/user-already-joined.exception';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async create(command: RegisterUserCommand): Promise<UserView> {
    const token = command.token.replace('Bearer ', '');
    const firebaseUser: any = await auth()
      .verifyIdToken(token, true)
      .catch((error) => {
        throw new UnauthorizedException(error.message);
      });

    const existing = await this.userRepository.findByFirebaseUid(
      firebaseUser.uid,
    );
    if (existing) {
      throw new UserAlredyJoinedException(firebaseUser.uid);
    }

    return this.userRepository.create({
      nickname: command.nickname,
      firebaseUid: firebaseUser.uid,
      oauthProvider: firebaseUser.firebase.sign_in_provider,
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
