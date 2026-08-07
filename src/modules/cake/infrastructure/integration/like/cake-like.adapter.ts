import { Injectable } from '@nestjs/common';
import {
  CakeLikePort,
  CakeLikeTarget,
  CakeLikeView,
} from '../../../application/port/cake-like.port';
import { CakeRepositoryPort } from '../../../application/port/cake-repository.port';
import { CakeLikeMapper } from './cake-like.mapper';

@Injectable()
export class CakeLikeAdapter implements CakeLikePort {
  constructor(private readonly cakeRepository: CakeRepositoryPort) {}

  async findByIds(cakeIds: string[]): Promise<CakeLikeView[]> {
    const cakes = await this.cakeRepository.findByIds(cakeIds);
    return cakes.map(CakeLikeMapper.toView);
  }

  async findTargetOrThrow(cakeId: string): Promise<CakeLikeTarget> {
    const cake = await this.cakeRepository.findByIdOrThrow(cakeId);
    return { likedUserIds: [...cake.likedUserIds] };
  }

  async addUserLike(cakeId: string, userId: string): Promise<void> {
    await this.cakeRepository.addUserLike(cakeId, userId);
  }

  async removeUserLike(cakeId: string, userId: string): Promise<void> {
    await this.cakeRepository.removeUserLike(cakeId, userId);
  }
}
