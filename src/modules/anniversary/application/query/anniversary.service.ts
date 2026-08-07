import { Injectable, NotFoundException } from '@nestjs/common';
import { ClipSearchPort } from 'src/integrations/ai-search/application/clip-search.port';
import {
  AnniversaryRecommendationView,
  AnniversaryView,
} from 'src/modules/anniversary/application/query/anniversary.view';
import { AnniversaryRepositoryPort } from '../port/anniversary-repository.port';

@Injectable()
export class AnniversaryService {
  constructor(
    private readonly anniversaryRepository: AnniversaryRepositoryPort,
    private readonly clipClient: ClipSearchPort,
  ) {}

  async getAnniversaryWord(id: string) {
    return this.anniversaryRepository.findById(id);
  }

  async findNextAnniversary(maxTimeMs?: number) {
    const anniversary = await this.anniversaryRepository.findNext(maxTimeMs);
    if (!anniversary) {
      throw new NotFoundException('Upcoming anniversary not found');
    }
    return anniversary;
  }

  async getAnniversaryRecommendations(
    anniversary: AnniversaryView,
    signal?: AbortSignal,
  ): Promise<AnniversaryRecommendationView> {
    const keyword = anniversary.keyword.join(', ');
    const cakes = await this.clipClient.koSearch(keyword, 6, signal);

    const images = [];
    for (const cake of cakes) {
      images.push(cake.image.s3Url);
    }
    const now = new Date();
    const day =
      Math.abs(now.getTime() - anniversary.date.getTime()) /
      (1000 * 60 * 60 * 24);
    return {
      id: anniversary.id,
      name: anniversary.name,
      dday: `D-${Math.floor(day)}`,
      mention: anniversary.mention,
      images,
    };
  }
}
