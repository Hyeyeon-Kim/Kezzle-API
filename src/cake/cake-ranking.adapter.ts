import { Injectable } from '@nestjs/common';
import { CakeRepository } from './cake.repository';
import { CakeRankingReader, CakeRankingView } from './cake-ranking.reader';

@Injectable()
export class CakeRankingRepositoryAdapter implements CakeRankingReader {
  constructor(private readonly cakeRepository: CakeRepository) {}

  async findByIds(cakeIds: string[]): Promise<CakeRankingView[]> {
    const cakes = await this.cakeRepository.findRankingByIds(cakeIds);
    return cakes.map((cake) => ({
      id: cake.id,
      image: cake.image,
      ownerStoreId: cake.ownerStoreId,
      likeText: cake.likeText,
      tags: [...cake.tags],
    }));
  }
}
