import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from 'src/modules/user/application/authenticated-user';
import { AnniversaryService } from 'src/modules/anniversary/application/anniversary.service';
import { VitClient } from 'src/integrations/ai-search/vit-client';
import { ClipClient } from 'src/integrations/ai-search/clip-client';
import { CakeRepository } from '../infrastructure/persistence/cake.repository';
import { CakeExternalMapper } from '../infrastructure/cake-external.mapper';
import { CakePageView } from './cake-result.view';
import { CakeView } from './cake.view';

@Injectable()
export class CakeService {
  constructor(
    private readonly anniversaryService: AnniversaryService,
    private readonly vitClient: VitClient,
    private readonly clipClient: ClipClient,
    private readonly cakeRepository: CakeRepository,
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
  ): Promise<CakeView[]> {
    const cakes = await this.vitClient.similarSearch(seedCakeId, 6, signal);

    return cakes.map((cake) => CakeExternalMapper.toView(cake));
  }

  async findOne(cakeid: string): Promise<CakeView> {
    return this.cakeRepository.findByIdOrThrow(cakeid);
  }

  async anniversary(anniId: string, page: number): Promise<CakePageView> {
    if (Number.isNaN(page)) page = 0;
    const anniversary =
      await this.anniversaryService.getAnniversaryWord(anniId);
    const keyword = anniversary.keyword.join(', ');
    const { result } = await this.clipClient.koSearchPage(keyword, 20, page);
    return {
      cakes: result.map((cake) => CakeExternalMapper.toView(cake)),
      hasMore: false,
    };
  }
}
