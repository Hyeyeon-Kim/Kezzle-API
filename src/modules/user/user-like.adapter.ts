import { Injectable } from '@nestjs/common';
import { UserLikePort, UserLikeView } from './user-like.port';
import { UserRepository } from './user.repository';

@Injectable()
export class UserLikeRepositoryAdapter implements UserLikePort {
  constructor(private readonly userRepository: UserRepository) {}

  async findByFirebaseUidOrThrow(userId: string): Promise<UserLikeView> {
    const user = await this.userRepository.findByFirebaseUidOrThrow(userId);
    return {
      firebaseUid: user.firebaseUid,
      cakeLikeIds: [...user.cakeLikeIds],
      storeLikeIds: [...user.storeLikeIds],
    };
  }

  async addCakeLike(userId: string, cakeId: string): Promise<void> {
    await this.userRepository.addCakeLike(userId, cakeId);
  }

  async removeCakeLike(userId: string, cakeId: string): Promise<void> {
    await this.userRepository.removeCakeLike(userId, cakeId);
  }

  async addStoreLike(userId: string, storeId: string): Promise<void> {
    await this.userRepository.addStoreLike(userId, storeId);
  }

  async removeStoreLike(userId: string, storeId: string): Promise<void> {
    await this.userRepository.removeStoreLike(userId, storeId);
  }
}
