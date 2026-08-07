import { Injectable } from '@nestjs/common';
import {
  StoreLikePort,
  StoreLikeTarget,
  StoreLikeView,
} from 'src/modules/store/application/port/store-like.port';
import { StoreRepository } from 'src/modules/store/infrastructure/persistence/store.repository';

@Injectable()
export class StoreLikeRepositoryAdapter implements StoreLikePort {
  constructor(private readonly storeRepository: StoreRepository) {}

  async findByUserLike(userId: string): Promise<StoreLikeView[]> {
    const stores = await this.storeRepository.findByUserLike(userId);
    return stores.map((store) => ({
      id: store.id,
      name: store.name,
      logo: store.logo,
      address: store.address,
      likedUserIds: [...store.likedUserIds],
    }));
  }

  async findTargetOrThrow(storeId: string): Promise<StoreLikeTarget> {
    const store = await this.storeRepository.findByIdOrThrow(storeId);
    return { likedUserIds: [...store.likedUserIds] };
  }

  async addUserLike(storeId: string, userId: string): Promise<void> {
    await this.storeRepository.addUserLike(storeId, userId);
  }

  async removeUserLike(storeId: string, userId: string): Promise<void> {
    await this.storeRepository.removeUserLike(storeId, userId);
  }
}
