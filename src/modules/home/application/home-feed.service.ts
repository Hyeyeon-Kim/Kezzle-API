import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AnniversaryService } from 'src/modules/anniversary/application/anniversary.service';
import { AnniversaryRecommendationView } from 'src/modules/anniversary/application/anniversary.view';
import { CakeService } from 'src/modules/cake/application/cake.service';
import { CakePageView } from 'src/modules/cake/application/cake-result.view';
import { CakeView } from 'src/modules/cake/application/cake.view';
import { CurationQueryService } from 'src/modules/curation/application/curation-query.service';
import { CurationView } from 'src/modules/curation/application/curation.view';
import { HomeCacheService } from 'src/modules/home/infrastructure/cache/home-cache.service';
import { homeCachePolicy } from 'src/modules/home/infrastructure/cache/home-cache.policy';
import { homeCacheKey } from 'src/modules/home/infrastructure/cache/home-cache.constants';
import {
  KeywordRankingView,
  PopularRankingView,
} from 'src/modules/ranking/application/ranking.view';
import { RankingQueryService } from 'src/modules/ranking/application/ranking-query.service';
import { AuthenticatedUser } from 'src/modules/user/application/authenticated-user';
import {
  HomeSectionMetadataView,
  HomeSectionsView,
  HomeView,
} from './home.view';
import { HomeMetrics } from './home-metrics.port';
import { HomeSectionName } from './home-metrics.types';
import { ConfigType } from '@nestjs/config';
import homeConfig from 'src/platform/config/home.config';
import {
  executeHomeSection,
  HomeSectionFallbackReason,
  HomeSectionResult,
  startHomeDeadline,
} from './home-section.executor';

@Injectable()
export class HomeFeedService {
  private readonly logger = new Logger(HomeFeedService.name);

  constructor(
    private readonly cakeService: CakeService,
    private readonly anniversaryService: AnniversaryService,
    private readonly rankingQuery: RankingQueryService,
    private readonly curationQuery: CurationQueryService,
    private readonly homeMetrics: HomeMetrics,
    private readonly homeCache: HomeCacheService,
    @Inject(homeConfig.KEY)
    private readonly config: ConfigType<typeof homeConfig>,
  ) {}

  async getHome(user: AuthenticatedUser | undefined): Promise<HomeView> {
    const startedAt = process.hrtime.bigint();
    return this.homeMetrics.run(async () => {
      try {
        const response = await this.buildHome(user);
        this.homeMetrics.flush('success');
        this.homeMetrics.observeRequest(
          'success',
          this.elapsedSeconds(startedAt),
        );
        return response;
      } catch (error) {
        this.homeMetrics.flush('error');
        this.homeMetrics.observeRequest(
          'error',
          this.elapsedSeconds(startedAt),
        );
        throw error;
      }
    });
  }

  private async buildHome(
    user: AuthenticatedUser | undefined,
  ): Promise<HomeView> {
    const deadline = startHomeDeadline(this.getHomeHardDeadlineMs());
    const startedAt = process.hrtime.bigint();

    try {
      const recommendFallback: CakeView[] = [];
      const anniversaryFallback = this.emptyAnniversary();
      const popularFallback = this.rankingQuery.getPopularFallback();
      const keywordRanksFallback = this.rankingQuery.getKeywordFallback();
      const newestCakesFallback: CakePageView = {
        cakes: [],
        hasMore: false,
      };
      const curationsFallback: CurationView[] = [];

      let recommendResult: HomeSectionResult<CakeView[]> | undefined;
      let anniversaryResult:
        | HomeSectionResult<AnniversaryRecommendationView>
        | undefined;
      let popularResult: HomeSectionResult<PopularRankingView> | undefined;
      let keywordRanksResult: HomeSectionResult<KeywordRankingView> | undefined;
      let newestCakesResult: HomeSectionResult<CakePageView> | undefined;
      let curationsResult: HomeSectionResult<CurationView[]> | undefined;

      const recommendTimeout = this.getSectionTimeout('recommendCakes');
      const recommendSection = this.homeMetrics
        .timeSection('recommend', () =>
          this.runSection(
            'recommendCakes',
            recommendTimeout,
            recommendFallback,
            async (signal) => {
              this.homeMetrics.countDb();
              const seedCakeId = await this.cakeService.findRecommendationSeed(
                user,
                recommendTimeout,
              );
              if (seedCakeId === null) {
                return recommendFallback;
              }
              return this.homeCache.getWithSwr({
                key: homeCacheKey(`similar:${seedCakeId}`),
                ...homeCachePolicy(this.config.cache.policies, 'recommend'),
                refresh: async () => {
                  this.homeMetrics.countAi('vit');
                  return this.cakeService
                    .findAllByRecommend(seedCakeId, signal)
                    .catch((error) => {
                      this.homeMetrics.countAiError('vit');
                      throw error;
                    });
                },
              });
            },
            deadline.signal,
          ),
        )
        .then(
          (result) => {
            recommendResult = result;
          },
          (error) => {
            recommendResult = this.unexpectedSectionFallback(
              'recommendCakes',
              recommendFallback,
              error,
              startedAt,
            );
          },
        );

      const anniversaryTimeout = this.getSectionTimeout('anniversary');
      const anniversarySection = this.homeMetrics
        .timeSection('anniversary', () =>
          this.runSection(
            'anniversary',
            anniversaryTimeout,
            anniversaryFallback,
            (signal) =>
              this.homeCache.getWithSwr({
                key: homeCacheKey('anniversary'),
                ...homeCachePolicy(this.config.cache.policies, 'anniversary'),
                refresh: async () => {
                  this.homeMetrics.countDb();
                  const anniversary =
                    await this.anniversaryService.findNextAnniversary(
                      anniversaryTimeout,
                    );
                  this.homeMetrics.countAi('clip');
                  return this.anniversaryService
                    .getAnniversaryRecommendations(anniversary, signal)
                    .catch((error) => {
                      this.homeMetrics.countAiError('clip');
                      throw error;
                    });
                },
              }),
            deadline.signal,
          ),
        )
        .then(
          (result) => {
            anniversaryResult = result;
          },
          (error) => {
            anniversaryResult = this.unexpectedSectionFallback(
              'anniversary',
              anniversaryFallback,
              error,
              startedAt,
            );
          },
        );

      const popularTimeout = this.getSectionTimeout('popularCakes');
      const popularSection = this.homeMetrics
        .timeSection('popular', () =>
          this.runSection(
            'popularCakes',
            popularTimeout,
            popularFallback,
            () =>
              this.homeCache.getWithSwr({
                key: homeCacheKey('popular'),
                ...homeCachePolicy(this.config.cache.policies, 'popular'),
                refresh: () => {
                  this.homeMetrics.countDb(2);
                  return this.rankingQuery.getPopularCakes(
                    NaN,
                    3,
                    popularTimeout,
                  );
                },
              }),
            deadline.signal,
          ),
        )
        .then(
          (result) => {
            popularResult = result;
          },
          (error) => {
            popularResult = this.unexpectedSectionFallback(
              'popularCakes',
              popularFallback,
              error,
              startedAt,
            );
          },
        );

      const keywordRanksTimeout = this.getSectionTimeout('keywordRanks');
      const keywordRanksSection = this.homeMetrics
        .timeSection('keywordRanks', () =>
          this.runSection(
            'keywordRanks',
            keywordRanksTimeout,
            keywordRanksFallback,
            () =>
              this.homeCache.getWithSwr({
                key: homeCacheKey('keyword-ranks'),
                ...homeCachePolicy(this.config.cache.policies, 'keywordRanks'),
                refresh: () => {
                  this.homeMetrics.countDb(2);
                  return this.rankingQuery.getKeywordRank(
                    undefined,
                    undefined,
                    4,
                    keywordRanksTimeout,
                  );
                },
              }),
            deadline.signal,
          ),
        )
        .then(
          (result) => {
            keywordRanksResult = result;
          },
          (error) => {
            keywordRanksResult = this.unexpectedSectionFallback(
              'keywordRanks',
              keywordRanksFallback,
              error,
              startedAt,
            );
          },
        );

      const newestCakesTimeout = this.getSectionTimeout('newestCakes');
      const newestCakesSection = this.homeMetrics
        .timeSection('newestCakes', () =>
          this.runSection(
            'newestCakes',
            newestCakesTimeout,
            newestCakesFallback,
            () =>
              this.homeCache.getWithSwr({
                key: homeCacheKey('newest:4'),
                ...homeCachePolicy(this.config.cache.policies, 'newest'),
                refresh: () => {
                  this.homeMetrics.countDb();
                  return this.cakeService.findAllByNewest(
                    undefined,
                    4,
                    newestCakesTimeout,
                  );
                },
              }),
            deadline.signal,
          ),
        )
        .then(
          (result) => {
            newestCakesResult = result;
          },
          (error) => {
            newestCakesResult = this.unexpectedSectionFallback(
              'newestCakes',
              newestCakesFallback,
              error,
              startedAt,
            );
          },
        );

      const curationsTimeout = this.getSectionTimeout('curations');
      const curationsSection = this.homeMetrics
        .timeSection('curations', () =>
          this.runSection(
            'curations',
            curationsTimeout,
            curationsFallback,
            () =>
              this.homeCache.getWithSwr({
                key: homeCacheKey('curations'),
                ...homeCachePolicy(this.config.cache.policies, 'curations'),
                refresh: async () => {
                  this.homeMetrics.countDb();
                  const curations = await this.curationQuery.findFeatured(
                    4,
                    curationsTimeout,
                  );
                  return curations;
                },
              }),
            deadline.signal,
          ),
        )
        .then(
          (result) => {
            curationsResult = result;
          },
          (error) => {
            curationsResult = this.unexpectedSectionFallback(
              'curations',
              curationsFallback,
              error,
              startedAt,
            );
          },
        );

      await Promise.race([
        Promise.allSettled([
          recommendSection,
          anniversarySection,
          popularSection,
          keywordRanksSection,
          newestCakesSection,
          curationsSection,
        ]),
        deadline.expired,
      ]);

      const results = {
        recommendCakes:
          recommendResult ??
          this.deadlineFallback('recommendCakes', recommendFallback, startedAt),
        anniversary:
          anniversaryResult ??
          this.deadlineFallback('anniversary', anniversaryFallback, startedAt),
        popularCakes:
          popularResult ??
          this.deadlineFallback('popularCakes', popularFallback, startedAt),
        keywordRanks:
          keywordRanksResult ??
          this.deadlineFallback(
            'keywordRanks',
            keywordRanksFallback,
            startedAt,
          ),
        newestCakes:
          newestCakesResult ??
          this.deadlineFallback('newestCakes', newestCakesFallback, startedAt),
        curations:
          curationsResult ??
          this.deadlineFallback('curations', curationsFallback, startedAt),
      };

      for (const [section, result] of Object.entries(results)) {
        this.homeMetrics.observeSection(
          section as HomeSectionName,
          result.status,
          result.status === 'fallback' ? result.reason : 'none',
          result.durationMs / 1000,
        );
      }

      const coreResults = [
        results.recommendCakes,
        results.popularCakes,
        results.newestCakes,
      ];
      if (coreResults.every((result) => result.status === 'fallback')) {
        throw new ServiceUnavailableException(
          'All core home sections are unavailable',
        );
      }

      const degraded = Object.values(results).some(
        (result) => result.status === 'fallback',
      );
      if (degraded) {
        this.homeMetrics.countDegraded();
      }

      return {
        anniversary: results.anniversary.data,
        recommendCakes: results.recommendCakes.data,
        popularCakes: results.popularCakes.data,
        keywordRanks: results.keywordRanks.data,
        newestCakes: results.newestCakes.data,
        curations: results.curations.data,
        degraded,
        sections: this.sectionMetadata(results),
      };
    } finally {
      deadline.clear();
    }
  }

  private runSection<T>(
    name: string,
    timeoutMs: number,
    fallback: T,
    operation: (signal: AbortSignal) => Promise<T>,
    parentSignal?: AbortSignal,
  ): Promise<HomeSectionResult<T>> {
    return executeHomeSection({
      name,
      timeoutMs,
      fallback,
      operation,
      parentSignal,
      onError: (error, reason) => this.logSectionFallback(name, error, reason),
    });
  }

  private deadlineFallback<T>(
    name: string,
    fallback: T,
    startedAt: bigint,
  ): HomeSectionResult<T> {
    this.logger.warn(
      `home hard deadline exceeded: section=${name} fallback applied`,
    );
    return {
      status: 'fallback',
      data: fallback,
      reason: 'timeout',
      durationMs: this.elapsedSectionMs(startedAt),
    };
  }

  private unexpectedSectionFallback<T>(
    name: string,
    fallback: T,
    error: unknown,
    startedAt: bigint,
  ): HomeSectionResult<T> {
    this.logSectionFallback(name, error, 'dependency_error');
    return {
      status: 'fallback',
      data: fallback,
      reason: 'dependency_error',
      durationMs: this.elapsedSectionMs(startedAt),
    };
  }

  private elapsedSectionMs(startedAt: bigint): number {
    const duration = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    return Math.round(duration * 100) / 100;
  }

  private elapsedSeconds(startedAt: bigint): number {
    return Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
  }

  private getHomeHardDeadlineMs(): number {
    return this.config.hardDeadlineMs;
  }

  private getSectionTimeout(
    name: keyof ConfigType<typeof homeConfig>['sectionTimeoutMs'],
  ): number {
    return this.config.sectionTimeoutMs[name];
  }

  private emptyAnniversary(): AnniversaryRecommendationView {
    return { id: '', name: '', dday: '', mention: '', images: [] };
  }

  private sectionMetadata(results: {
    recommendCakes: HomeSectionResult<unknown>;
    anniversary: HomeSectionResult<unknown>;
    popularCakes: HomeSectionResult<unknown>;
    keywordRanks: HomeSectionResult<unknown>;
    newestCakes: HomeSectionResult<unknown>;
    curations: HomeSectionResult<unknown>;
  }): HomeSectionsView {
    return {
      recommendCakes: this.sectionMetadataItem(results.recommendCakes),
      anniversary: this.sectionMetadataItem(results.anniversary),
      popularCakes: this.sectionMetadataItem(results.popularCakes),
      keywordRanks: this.sectionMetadataItem(results.keywordRanks),
      newestCakes: this.sectionMetadataItem(results.newestCakes),
      curations: this.sectionMetadataItem(results.curations),
    };
  }

  private sectionMetadataItem(
    result: HomeSectionResult<unknown>,
  ): HomeSectionMetadataView {
    return result.status === 'fallback'
      ? {
          status: result.status,
          reason: result.reason,
          durationMs: result.durationMs,
        }
      : { status: result.status, durationMs: result.durationMs };
  }

  private logSectionFallback(
    name: string,
    error: unknown,
    reason: HomeSectionFallbackReason,
  ): void {
    this.logger.warn(
      `home section fallback: section=${name} reason=${reason} error=${this.errorName(
        error,
      )}`,
    );
  }

  private errorName(error: unknown): string {
    return error instanceof Error ? error.name : 'UnknownError';
  }
}
