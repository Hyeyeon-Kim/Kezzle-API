import { Injectable } from '@nestjs/common';
import { AnniversaryService } from 'src/modules/anniversary/application/query/anniversary.service';
import { AnniversaryRecommendationView } from 'src/modules/anniversary/application/query/anniversary.view';
import { CakeQueryResult } from 'src/modules/cake/application/query/cake-query-result';
import { CakeQueryService } from 'src/modules/cake/application/query/cake-query.service';
import { Cake } from 'src/modules/cake/application/model/cake';
import { CurationView } from 'src/modules/curation/application/curation.view';
import { CurationQueryService } from 'src/modules/curation/application/query/curation-query.service';
import {
  KeywordRankingView,
  PopularRankingView,
} from 'src/modules/ranking/application/query/ranking.view';
import { RankingQueryService } from 'src/modules/ranking/application/query/ranking-query.service';
import { AuthenticatedUser } from 'src/platform/auth/authenticated-user';
import { HomeCachePort } from './port/home-cache.port';
import { HomeMetrics } from './port/home-metrics.port';

export interface HomeSectionData {
  readonly recommendCakes: Cake[];
  readonly anniversary: AnniversaryRecommendationView;
  readonly popularCakes: PopularRankingView;
  readonly keywordRanks: KeywordRankingView;
  readonly newestCakes: CakeQueryResult;
  readonly curations: CurationView[];
}

@Injectable()
export class HomeSectionLoader {
  constructor(
    private readonly cakeQuery: CakeQueryService,
    private readonly anniversaryService: AnniversaryService,
    private readonly rankingQuery: RankingQueryService,
    private readonly curationQuery: CurationQueryService,
    private readonly homeCache: HomeCachePort,
    private readonly homeMetrics: HomeMetrics,
  ) {}

  getFallbacks(): HomeSectionData {
    return {
      recommendCakes: [],
      anniversary: { id: '', name: '', dday: '', mention: '', images: [] },
      popularCakes: this.rankingQuery.getPopularFallback(),
      keywordRanks: this.rankingQuery.getKeywordFallback(),
      newestCakes: { cakes: [], hasMore: false },
      curations: [],
    };
  }

  async loadRecommendCakes(
    user: AuthenticatedUser | undefined,
    timeoutMs: number,
    signal: AbortSignal,
  ): Promise<Cake[]> {
    this.homeMetrics.countDb();
    const seedCakeId = await this.cakeQuery.findRecommendationSeed(
      user,
      timeoutMs,
    );
    if (seedCakeId === null) {
      return [];
    }

    return this.homeCache.getWithSwr({
      keySuffix: `similar:${seedCakeId}`,
      policy: 'recommend',
      refresh: async () => {
        this.homeMetrics.countAi('vit');
        return this.cakeQuery
          .findAllByRecommend(seedCakeId, signal)
          .catch((error) => {
            this.homeMetrics.countAiError('vit');
            throw error;
          });
      },
    });
  }

  loadAnniversary(
    timeoutMs: number,
    signal: AbortSignal,
  ): Promise<AnniversaryRecommendationView> {
    return this.homeCache.getWithSwr({
      keySuffix: 'anniversary',
      policy: 'anniversary',
      refresh: async () => {
        this.homeMetrics.countDb();
        const anniversary =
          await this.anniversaryService.findNextAnniversary(timeoutMs);
        this.homeMetrics.countAi('clip');
        return this.anniversaryService
          .getAnniversaryRecommendations(anniversary, signal)
          .catch((error) => {
            this.homeMetrics.countAiError('clip');
            throw error;
          });
      },
    });
  }

  loadPopularCakes(timeoutMs: number): Promise<PopularRankingView> {
    return this.homeCache.getWithSwr({
      keySuffix: 'popular',
      policy: 'popular',
      refresh: () => {
        this.homeMetrics.countDb(2);
        return this.rankingQuery.getPopularCakes(NaN, 3, timeoutMs);
      },
    });
  }

  loadKeywordRanks(timeoutMs: number): Promise<KeywordRankingView> {
    return this.homeCache.getWithSwr({
      keySuffix: 'keyword-ranks',
      policy: 'keywordRanks',
      refresh: () => {
        this.homeMetrics.countDb(2);
        return this.rankingQuery.getKeywordRank(
          undefined,
          undefined,
          4,
          timeoutMs,
        );
      },
    });
  }

  loadNewestCakes(timeoutMs: number): Promise<CakeQueryResult> {
    return this.homeCache.getWithSwr({
      keySuffix: 'newest:4',
      policy: 'newest',
      refresh: () => {
        this.homeMetrics.countDb();
        return this.cakeQuery.findAllByNewest(undefined, 4, timeoutMs);
      },
    });
  }

  loadCurations(timeoutMs: number): Promise<CurationView[]> {
    return this.homeCache.getWithSwr({
      keySuffix: 'curations',
      policy: 'curations',
      refresh: async () => {
        this.homeMetrics.countDb();
        return this.curationQuery.findFeatured(4, timeoutMs);
      },
    });
  }
}
