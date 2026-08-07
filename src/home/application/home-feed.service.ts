import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import homeConfig from 'src/config/home.config';
import { AuthenticatedUser } from 'src/user/application/authenticated-user';
import {
  HomeFeedView,
  HomeSectionMetadataView,
  HomeSectionsView,
} from './home-feed.view';
import {
  executeHomeSection,
  HomeSectionFallbackReason,
  HomeSectionResult,
  startHomeDeadline,
} from './home-section.executor';
import { HomeSectionData, HomeSectionLoader } from './home-section.loader';
import { HomeMetrics } from './port/home-metrics.port';
import { HomeSectionName } from './port/home-metrics.types';

type HomeSectionResults = {
  [Section in keyof HomeSectionData]: HomeSectionResult<
    HomeSectionData[Section]
  >;
};

@Injectable()
export class HomeFeedService {
  private readonly logger = new Logger(HomeFeedService.name);

  constructor(
    private readonly sectionLoader: HomeSectionLoader,
    private readonly homeMetrics: HomeMetrics,
    @Inject(homeConfig.KEY)
    private readonly config: ConfigType<typeof homeConfig>,
  ) {}

  async getHome(user: AuthenticatedUser | undefined): Promise<HomeFeedView> {
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
  ): Promise<HomeFeedView> {
    const deadline = startHomeDeadline(this.config.hardDeadlineMs);
    const startedAt = process.hrtime.bigint();
    const fallback = this.sectionLoader.getFallbacks();

    try {
      let recommendResult: HomeSectionResults['recommendCakes'] | undefined;
      let anniversaryResult: HomeSectionResults['anniversary'] | undefined;
      let popularResult: HomeSectionResults['popularCakes'] | undefined;
      let keywordRanksResult: HomeSectionResults['keywordRanks'] | undefined;
      let newestCakesResult: HomeSectionResults['newestCakes'] | undefined;
      let curationsResult: HomeSectionResults['curations'] | undefined;

      const recommendTimeout = this.getSectionTimeout('recommendCakes');
      const recommendSection = this.homeMetrics
        .timeSection('recommend', () =>
          this.runSection(
            'recommendCakes',
            recommendTimeout,
            fallback.recommendCakes,
            (signal) =>
              this.sectionLoader.loadRecommendCakes(
                user,
                recommendTimeout,
                signal,
              ),
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
              fallback.recommendCakes,
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
            fallback.anniversary,
            (signal) =>
              this.sectionLoader.loadAnniversary(anniversaryTimeout, signal),
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
              fallback.anniversary,
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
            fallback.popularCakes,
            () => this.sectionLoader.loadPopularCakes(popularTimeout),
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
              fallback.popularCakes,
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
            fallback.keywordRanks,
            () => this.sectionLoader.loadKeywordRanks(keywordRanksTimeout),
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
              fallback.keywordRanks,
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
            fallback.newestCakes,
            () => this.sectionLoader.loadNewestCakes(newestCakesTimeout),
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
              fallback.newestCakes,
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
            fallback.curations,
            () => this.sectionLoader.loadCurations(curationsTimeout),
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
              fallback.curations,
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

      const results: HomeSectionResults = {
        recommendCakes:
          recommendResult ??
          this.deadlineFallback(
            'recommendCakes',
            fallback.recommendCakes,
            startedAt,
          ),
        anniversary:
          anniversaryResult ??
          this.deadlineFallback(
            'anniversary',
            fallback.anniversary,
            startedAt,
          ),
        popularCakes:
          popularResult ??
          this.deadlineFallback(
            'popularCakes',
            fallback.popularCakes,
            startedAt,
          ),
        keywordRanks:
          keywordRanksResult ??
          this.deadlineFallback(
            'keywordRanks',
            fallback.keywordRanks,
            startedAt,
          ),
        newestCakes:
          newestCakesResult ??
          this.deadlineFallback(
            'newestCakes',
            fallback.newestCakes,
            startedAt,
          ),
        curations:
          curationsResult ??
          this.deadlineFallback(
            'curations',
            fallback.curations,
            startedAt,
          ),
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

  private runSection<Section extends HomeSectionName>(
    name: Section,
    timeoutMs: number,
    fallback: HomeSectionData[Section],
    operation: (signal: AbortSignal) => Promise<HomeSectionData[Section]>,
    parentSignal?: AbortSignal,
  ): Promise<HomeSectionResult<HomeSectionData[Section]>> {
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
    name: HomeSectionName,
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
    name: HomeSectionName,
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

  private getSectionTimeout(
    name: keyof ConfigType<typeof homeConfig>['sectionTimeoutMs'],
  ): number {
    return this.config.sectionTimeoutMs[name];
  }

  private sectionMetadata(results: HomeSectionResults): HomeSectionsView {
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
    name: HomeSectionName,
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
