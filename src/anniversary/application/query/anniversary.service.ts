import { Injectable, NotFoundException } from '@nestjs/common';
import { ClipClient } from 'src/ai-search/clip-client';
import {
  AnniversaryRecommendationView,
  AnniversaryView,
} from 'src/anniversary/application/query/anniversary.view';
import { AnniversaryRepository } from 'src/anniversary/infrastructure/persistence/anniversary.repository';

@Injectable()
export class AnniversaryService {
  constructor(
    private readonly anniversaryRepository: AnniversaryRepository,
    private readonly clipClient: ClipClient,
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
