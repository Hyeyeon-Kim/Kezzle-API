import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from 'src/user/application/authenticated-user';
import { AnniversaryService } from 'src/anniversary/application/query/anniversary.service';
import { VitClient } from 'src/ai-search/vit-client';
import { ClipClient } from 'src/ai-search/clip-client';
import { CakeRepositoryPort } from '../port/cake-repository.port';
import { CakeAiSearchMapper } from '../../infrastructure/integration/ai/cake-ai-search.mapper';
import { CakeQueryResult } from './cake-query-result';
import { Cake } from '../../domain/cake';

@Injectable()
export class CakeQueryService {
  constructor(
    private readonly anniversaryService: AnniversaryService,
    private readonly vitClient: VitClient,
    private readonly clipClient: ClipClient,
    private readonly cakeRepository: CakeRepositoryPort,
  ) {}
  async findAllByNewest(after: string, limit: number, maxTimeMs?: number) {
    if (Number.isNaN(limit)) {
      limit = 20;
    }

    let cakes = await this.cakeRepository.findNewest(
      after,
      limit + 1,
      maxTimeMs,
    );
    let hasMore = false;

    if (cakes.length > limit) {
      hasMore = true;
      cakes = cakes.slice(0, cakes.length - 1);
    }

    return { cakes, hasMore };
  }

  async findRecommendationSeed(
    user: AuthenticatedUser | undefined,
    maxTimeMs?: number,
  ): Promise<string | null> {
    const likedCakeIds = user?.cakeLikeIds ?? [];
    const randomIndex = Math.floor(Math.random() * likedCakeIds.length);
    const userLikedCakeId: string = likedCakeIds[randomIndex];

    if (
      userLikedCakeId === undefined ||
      (await this.cakeRepository.findById(userLikedCakeId, maxTimeMs)) === null
    ) {
      const sampledCake = await this.cakeRepository.sampleOne(maxTimeMs);
      return sampledCake?.id ?? null;
    }

    return userLikedCakeId;
  }

  async findAllByRecommend(
    seedCakeId: string,
    signal?: AbortSignal,
  ): Promise<Cake[]> {
    const cakes = await this.vitClient.similarSearch(seedCakeId, 6, signal);

    return cakes.map((cake) => CakeAiSearchMapper.toDomain(cake));
  }

  async findOne(cakeid: string): Promise<Cake> {
    return this.cakeRepository.findByIdOrThrow(cakeid);
  }

  async anniversary(anniId: string, page: number): Promise<CakeQueryResult> {
    if (Number.isNaN(page)) page = 0;
    const anniversary =
      await this.anniversaryService.getAnniversaryWord(anniId);
    const keyword = anniversary.keyword.join(', ');
    const { result } = await this.clipClient.koSearchPage(keyword, 20, page);
    return {
      cakes: result.map((cake) => CakeAiSearchMapper.toDomain(cake)),
      hasMore: false,
    };
  }
}
