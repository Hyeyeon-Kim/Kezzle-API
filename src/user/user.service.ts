import { Injectable, UnauthorizedException } from '@nestjs/common';
import { auth } from 'firebase-admin';
import { AuthenticatedUser } from './application/authenticated-user';
import { UserView } from './application/user.view';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateUserResponseDto } from './dto/response-create-user.dto';
import { UserResponseDto } from './dto/response-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserAlredyJoinedException } from './exceptions/user-already-joined.exception';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async create(
    token: string,
    createUserDto: CreateUserDto,
  ): Promise<CreateUserResponseDto> {
    token = token.replace('Bearer ', '');
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

    return new CreateUserResponseDto(
      await this.userRepository.create({
        nickname: createUserDto.nickname,
        firebaseUid: firebaseUser.uid,
        oauthProvider: firebaseUser.firebase.sign_in_provider,
      }),
    );
  }

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.findAll();
    return users.map((user) => new UserResponseDto(user));
  }

  async findOneByFirebase(firebaseUid: string): Promise<UserResponseDto> {
    return new UserResponseDto(
      await this.userRepository.findByFirebaseUidOrThrow(firebaseUid),
    );
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

  async changeContent(firebaseUid: string, updateData: UpdateUserDto) {
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
