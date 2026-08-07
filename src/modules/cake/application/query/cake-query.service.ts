import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from 'src/platform/auth/authenticated-user';
import { AnniversaryService } from 'src/modules/anniversary/application/query/anniversary.service';
import { VitSearchPort } from 'src/integrations/ai-search/application/vit-search.port';
import { ClipSearchPort } from 'src/integrations/ai-search/application/clip-search.port';
import { CakeRepositoryPort } from '../port/cake-repository.port';
import { CakeQueryResult } from './cake-query-result';
import { Cake } from '../model/cake';

@Injectable()
export class CakeQueryService {
  constructor(
    private readonly anniversaryService: AnniversaryService,
    private readonly vitClient: VitSearchPort,
    private readonly clipClient: ClipSearchPort,
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

    return cakes;
  }

  async findOne(cakeId: string): Promise<Cake> {
    return this.cakeRepository.findByIdOrThrow(cakeId);
  }

  async anniversary(anniId: string, page: number): Promise<CakeQueryResult> {
    if (Number.isNaN(page)) page = 0;
    const anniversary =
      await this.anniversaryService.getAnniversaryWord(anniId);
    const keyword = anniversary.keyword.join(', ');
    const { result } = await this.clipClient.koSearchPage(keyword, 20, page);
    return {
      cakes: result,
      hasMore: false,
    };
  }
}
