import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AnniversaryService } from 'src/anniversary/anniversary.service';
import { AnniversaryDto } from 'src/anniversary/dto/response-anniversary.dto';
import { CakeService } from 'src/cake/cake.service';
import { CakeSimpleResponseDto } from 'src/cake/dto/response-cake-simple.dto';
import { CakesSimpleResponseDto } from 'src/cake/dto/response-cakes-simple.dto';
import { PopularCakesResponseDto } from 'src/cake/dto/response-popular-cakes.dto';
import { CurationQueryService } from 'src/curation/curation-query.service';
import { HomeCacheService } from 'src/home-cache/home-cache.service';
import { homeCachePolicy } from 'src/home-cache/home-cache.policy';
import { HomeResilienceMetricsService } from 'src/home-resilience/home-resilience-metrics.service';
import {
  computeRankWindow,
  KEYWORD_RANK_WINDOW_DAYS_ENV,
  POPULAR_RANK_WINDOW_DAYS_ENV,
} from 'src/log/rank-window';
import {
  HomeSectionName,
  MonitoringService,
} from 'src/monitoring/monitoring.service';
import { SearchService } from 'src/search/search.service';
import { RankResponseDto } from 'src/search/dto/response-search-rank.dto';
import IUser from 'src/user/interfaces/user.interface';
import { HomeCurationItemDto } from './dto/home-curation.dto';
import { HomeResponseDto } from './dto/home-response.dto';
import { HomeSectionsMetadataDto } from './dto/home-section-metadata.dto';
import {
  executeHomeSection,
  HomeSectionFallbackReason,
  HomeSectionResult,
  startHomeDeadline,
} from './home-section.executor';

const HOME_SECTION_TIMEOUTS = {
  recommendCakes: { env: 'HOME_RECOMMEND_TIMEOUT_MS', defaultMs: 250 },
  anniversary: { env: 'HOME_ANNIVERSARY_TIMEOUT_MS', defaultMs: 250 },
  popularCakes: { env: 'HOME_POPULAR_TIMEOUT_MS', defaultMs: 50 },
  keywordRanks: { env: 'HOME_KEYWORD_RANKS_TIMEOUT_MS', defaultMs: 400 },
  newestCakes: { env: 'HOME_NEWEST_TIMEOUT_MS', defaultMs: 100 },
  curations: { env: 'HOME_CURATIONS_TIMEOUT_MS', defaultMs: 100 },
} as const;

const HOME_HARD_DEADLINE = {
  env: 'HOME_HARD_DEADLINE_MS',
  defaultMs: 600,
} as const;

@Injectable()
export class HomeFeedService {
  private readonly logger = new Logger(HomeFeedService.name);

  constructor(
    private readonly cakeService: CakeService,
    private readonly anniversaryService: AnniversaryService,
    private readonly searchService: SearchService,
    private readonly curationQuery: CurationQueryService,
    private readonly homeMetrics: HomeResilienceMetricsService,
    private readonly homeCache: HomeCacheService,
    private readonly monitoring: MonitoringService,
  ) {}

  async getHome(user: IUser | undefined): Promise<HomeResponseDto> {
    const startedAt = process.hrtime.bigint();
    return this.homeMetrics.run(async () => {
      try {
        const response = await this.buildHome(user);
        this.homeMetrics.flush('success');
        this.monitoring.observeHomeRequest(
          'success',
          this.elapsedSeconds(startedAt),
        );
        return response;
      } catch (error) {
        this.homeMetrics.flush('error');
        this.monitoring.observeHomeRequest(
          'error',
          this.elapsedSeconds(startedAt),
        );
        throw error;
      }
    });
  }

  private async buildHome(user: IUser | undefined): Promise<HomeResponseDto> {
    const deadline = startHomeDeadline(this.getHomeHardDeadlineMs());
    const startedAt = process.hrtime.bigint();

    try {
      const recommendFallback: CakeSimpleResponseDto[] = [];
      const anniversaryFallback = this.emptyAnniversary();
      const popularWindow = computeRankWindow(POPULAR_RANK_WINDOW_DAYS_ENV);
      const popularFallback = new PopularCakesResponseDto(
        [],
        popularWindow.startDate,
        popularWindow.endDate,
      );
      const keywordWindow = computeRankWindow(KEYWORD_RANK_WINDOW_DAYS_ENV);
      const keywordRanksFallback = new RankResponseDto(
        [],
        keywordWindow.startDate,
        keywordWindow.endDate,
      );
      const newestCakesFallback = new CakesSimpleResponseDto([], false);
      const curationsFallback: HomeCurationItemDto[] = [];

      let recommendResult:
        | HomeSectionResult<CakeSimpleResponseDto[]>
        | undefined;
      let anniversaryResult: HomeSectionResult<AnniversaryDto> | undefined;
      let popularResult: HomeSectionResult<PopularCakesResponseDto> | undefined;
      let keywordRanksResult: HomeSectionResult<RankResponseDto> | undefined;
      let newestCakesResult:
        | HomeSectionResult<CakesSimpleResponseDto>
        | undefined;
      let curationsResult: HomeSectionResult<HomeCurationItemDto[]> | undefined;

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
              return this.homeCache.getWithSwr({
                key: `home:similar:${seedCakeId}`,
                ...homeCachePolicy('recommend'),
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
                key: 'home:anniversary',
                ...homeCachePolicy('anniversary'),
                refresh: async () => {
                  this.homeMetrics.countDb();
                  this.homeMetrics.countAi('clip');
                  return this.anniversaryService
                    .getAnniversary(signal, anniversaryTimeout)
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
                key: 'home:popular',
                ...homeCachePolicy('popular'),
                refresh: () => {
                  this.homeMetrics.countDb(2);
                  return this.cakeService.popular(NaN, 3, popularTimeout);
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
                key: 'home:keyword-ranks',
                ...homeCachePolicy('keywordRanks'),
                refresh: () => {
                  this.homeMetrics.countDb(2);
                  return this.searchService.getRank(
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
                key: 'home:newest:4',
                ...homeCachePolicy('newest'),
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
                key: 'home:curations',
                ...homeCachePolicy('curations'),
                refresh: async () => {
                  this.homeMetrics.countDb();
                  const curations = await this.curationQuery.findFeatured(
                    4,
                    curationsTimeout,
                  );
                  return curations.map(
                    (curation) => new HomeCurationItemDto(curation),
                  );
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
        this.monitoring.observeHomeSection(
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
        this.monitoring.countHomeDegraded();
      }

      return new HomeResponseDto(
        results.anniversary.data,
        results.recommendCakes.data,
        results.popularCakes.data,
        results.keywordRanks.data,
        results.newestCakes.data,
        results.curations.data,
        degraded,
        new HomeSectionsMetadataDto(results),
      );
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
    const configured = Number(process.env[HOME_HARD_DEADLINE.env]);
    return Number.isFinite(configured) && configured > 0
      ? configured
      : HOME_HARD_DEADLINE.defaultMs;
  }

  private getSectionTimeout(name: keyof typeof HOME_SECTION_TIMEOUTS): number {
    const config = HOME_SECTION_TIMEOUTS[name];
    const configured = Number(process.env[config.env]);
    return Number.isFinite(configured) && configured > 0
      ? configured
      : config.defaultMs;
  }

  private emptyAnniversary(): AnniversaryDto {
    return { _id: '', name: '', dday: '', ment: '', images: [] };
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
