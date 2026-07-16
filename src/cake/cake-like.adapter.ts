import { Injectable } from '@nestjs/common';
import { CakeLikePort, CakeLikeTarget, CakeLikeView } from './cake-like.port';
import { CakeRepository } from './cake.repository';

@Injectable()
export class CakeLikeRepositoryAdapter implements CakeLikePort {
  constructor(private readonly cakeRepository: CakeRepository) {}

  async findByIds(cakeIds: string[]): Promise<CakeLikeView[]> {
    const cakes = await this.cakeRepository.findByIds(cakeIds);
    return cakes.map((cake) => this.toView(cake));
  }

  async findTargetOrThrow(cakeId: string): Promise<CakeLikeTarget> {
    const cake = await this.cakeRepository.findByIdOrThrow(cakeId);
    return { likedUserIds: [...(cake?.user_like_ids ?? [])] };
  }

  async addUserLike(cakeId: string, userId: string): Promise<void> {
    await this.cakeRepository.addUserLike(cakeId, userId);
  }

  async removeUserLike(cakeId: string, userId: string): Promise<void> {
    await this.cakeRepository.removeUserLike(cakeId, userId);
  }

  private toView(cake: any): CakeLikeView {
    return {
      id: cake?._id?.toString() ?? cake?.id?.toString(),
      image: cake?.image,
      ownerStoreId: cake?.owner_store_id,
      likedUserIds: [...(cake?.user_like_ids ?? [])],
      cursor: cake?.cursor,
      tags: [...(cake?.tag_ins ?? [])],
    };
  }
}
