import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Curation } from './entities/curation.schema';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { CurationDto } from './dto/response-curation.dto';
import { CurationsDto } from './dto/response-curations.dto';
import { HomeCurationDto } from './dto/response-home-curation.dto';
import { CurationNotFoundException } from './exceptions/curation-not-found.exception';
import { CurationCakeResponsDto } from './dto/response-curation-cake.dto';
import { AnniversaryService } from 'src/anniversary/anniversary.service';
import { CakeService } from 'src/cake/cake.service';
import { CakeSimpleResponseDto } from 'src/cake/dto/response-cake-simple.dto';
import { CurationDtoV2 } from './dto/response-curation.dto.v2';
import { AnniversaryDto } from 'src/anniversary/dto/response-anniversary.dto';
import { PopularCakesResponseDto } from 'src/cake/dto/response-popular-cakes.dto';
import { SearchService } from 'src/search/search.service';
import { RankResponseDto } from 'src/search/dto/response-search-rank.dto';
import { HomeCurationDtoV2 } from './dto/response-home-curation.dto.v2';
import { CakesSimpleResponseDto } from 'src/cake/dto/response-cakes-simple.dto';
import IUser from 'src/user/interfaces/user.interface';
import { HomeResilienceMetricsService } from 'src/home-resilience/home-resilience-metrics.service';
import {
  executeHomeSection,
  HomeSectionFallbackReason,
  HomeSectionResult,
  startHomeDeadline,
} from './home-section.executor';
import { HomeSectionsMetadataDto } from './dto/home-section-metadata.dto';
import {
  computeRankWindow,
  KEYWORD_RANK_WINDOW_DAYS_ENV,
  POPULAR_RANK_WINDOW_DAYS_ENV,
} from 'src/log/rank-window';

const HOME_SECTION_TIMEOUTS = {
  recommendCakes: {
    env: 'HOME_RECOMMEND_TIMEOUT_MS',
    defaultMs: 250,
  },
  anniversary: {
    env: 'HOME_ANNIVERSARY_TIMEOUT_MS',
    defaultMs: 250,
  },
  popularCakes: {
    env: 'HOME_POPULAR_TIMEOUT_MS',
    defaultMs: 50,
  },
  keywordRanks: {
    env: 'HOME_KEYWORD_RANKS_TIMEOUT_MS',
    defaultMs: 400,
  },
  newestCakes: {
    env: 'HOME_NEWEST_TIMEOUT_MS',
    defaultMs: 100,
  },
  curations: {
    env: 'HOME_CURATIONS_TIMEOUT_MS',
    defaultMs: 100,
  },
} as const;

const HOME_HARD_DEADLINE = {
  env: 'HOME_HARD_DEADLINE_MS',
  defaultMs: 600,
} as const;

@Injectable()
export class CurationService {
  private readonly logger = new Logger(CurationService.name);

  constructor(
    @InjectModel(Curation.name, 'kezzle')
    private readonly curationModel: Model<Curation>,
    private readonly httpService: HttpService,
    private readonly cakeService: CakeService,
    private readonly anniversaryService: AnniversaryService,
    private readonly searchService: SearchService,
    private readonly homeMetrics: HomeResilienceMetricsService,
  ) {}

  private clipApiUrl(path: string): string {
    const baseUrl =
      process.env.CLIP_API_BASE_URL ?? 'https://api.kezzlecake.com/clip';
    return `${baseUrl}${path}`;
  }

  async createCuration(keyword: string, disc: string, note: string) {
    const apiUrl = this.clipApiUrl(
      `/cakes/ko-search?keyword=${keyword}&size=100`,
    );
    this.homeMetrics.countAi();
    const response = await this.httpService
      .get(apiUrl)
      .toPromise()
      .catch((error) => {
        this.homeMetrics.countAiError();
        throw error;
      });
    const cakes = response.data.result;

    return await this.curationModel.create({
      cakes: cakes,
      description: disc,
      key: keyword,
      note: note,
    });
  }

  async updateCuration(curationId: string) {
    this.homeMetrics.countDb();
    const curation = await this.curationModel.findById(curationId).catch(() => {
      throw new CurationNotFoundException(curationId);
    });

    const apiUrl = this.clipApiUrl(
      `/cakes/ko-search?keyword=${curation.key}&size=100`,
    );
    this.homeMetrics.countAi();
    const response = await this.httpService
      .get(apiUrl)
      .toPromise()
      .catch((error) => {
        this.homeMetrics.countAiError();
        throw error;
      });
    const cakes = response.data.result;

    this.homeMetrics.countDb();
    // document.save() 는 내용이 같으면 no-op 이라 updatedAt 이 갱신되지 않고
    // stale 판정이 영원히 풀리지 않는다. updateOne 은 내용과 무관하게 updatedAt 을 갱신한다.
    await this.curationModel.updateOne(
      { _id: curation._id },
      { $set: { cakes } },
    );
  }

  async homeCuration() {
    const ments = ['상황별 BEST', '받는 사람들을 위한 케이크'];

    const result: CurationsDto[] = [];

    for (const ment of ments) {
      this.homeMetrics.countDb();
      const tmps = await this.curationModel.find({ note: ment });
      const Response = await tmps.map((tmp) => new CurationDto(tmp));
      result.push(new CurationsDto(Response, ment));
    }
    const ann = await this.anniversaryService.getAnniversary();
    const pop = await this.cakeService.popular(NaN, 10);
    return new HomeCurationDto(result, ann, pop);
  }

  async homeCurationV2(user: IUser | undefined): Promise<HomeCurationDtoV2> {
    return this.homeMetrics.run(async () => {
      try {
        const response = await this.buildHomeCurationV2(user);
        this.homeMetrics.flush('success');
        return response;
      } catch (error) {
        this.homeMetrics.flush('error');
        throw error;
      }
    });
  }

  private async buildHomeCurationV2(
    user: IUser | undefined,
  ): Promise<HomeCurationDtoV2> {
    const deadline = startHomeDeadline(this.getHomeHardDeadlineMs());
    const startedAt = process.hrtime.bigint();

    try {
      const recommendFallback: CakeSimpleResponseDto[] = [];
      const anniversaryFallback = this.emptyAnniversary();
      // fallback 의 날짜도 실제 집계 정책과 같은 rolling window 에서 파생시킨다.
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
      const curationsFallback: CurationDtoV2[] = [];

      let recommendResult:
        | HomeSectionResult<CakeSimpleResponseDto[]>
        | undefined;
      let anniversaryResult: HomeSectionResult<AnniversaryDto> | undefined;
      let popularResult: HomeSectionResult<PopularCakesResponseDto> | undefined;
      let keywordRanksResult: HomeSectionResult<RankResponseDto> | undefined;
      let newestCakesResult:
        | HomeSectionResult<CakesSimpleResponseDto>
        | undefined;
      let curationsResult: HomeSectionResult<CurationDtoV2[]> | undefined;

      const recommendTimeout = this.getSectionTimeout('recommendCakes');
      const recommendSection = this.homeMetrics
        .timeSection('recommend', () =>
          this.runSection<CakeSimpleResponseDto[]>(
            'recommendCakes',
            recommendTimeout,
            recommendFallback,
            (signal) =>
              this.cakeService.findAllByRecommend(
                user,
                signal,
                recommendTimeout,
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
              recommendFallback,
              error,
              startedAt,
            );
          },
        );

      const anniversaryTimeout = this.getSectionTimeout('anniversary');
      const anniversarySection = this.homeMetrics
        .timeSection('anniversary', () =>
          this.runSection<AnniversaryDto>(
            'anniversary',
            anniversaryTimeout,
            anniversaryFallback,
            (signal) =>
              this.anniversaryService.getAnniversary(
                signal,
                anniversaryTimeout,
              ),
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
          this.runSection<PopularCakesResponseDto>(
            'popularCakes',
            popularTimeout,
            popularFallback,
            () => this.cakeService.popular(NaN, 3, popularTimeout),
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
          this.runSection<RankResponseDto>(
            'keywordRanks',
            keywordRanksTimeout,
            keywordRanksFallback,
            () =>
              this.searchService.getRank(
                undefined,
                undefined,
                4,
                keywordRanksTimeout,
              ),
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
          this.runSection<CakesSimpleResponseDto>(
            'newestCakes',
            newestCakesTimeout,
            newestCakesFallback,
            () =>
              this.cakeService.findAllByNewest(
                undefined,
                4,
                newestCakesTimeout,
              ),
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
          this.runSection<CurationDtoV2[]>(
            'curations',
            curationsTimeout,
            curationsFallback,
            async () => {
              // stale 갱신은 CurationRefreshService job 이 담당한다. 홈 경로는 조회만 한다.
              this.homeMetrics.countDb();
              const query = this.curationModel.find().limit(4);
              query.maxTimeMS(curationsTimeout);
              return (await query).map(
                (curation) => new CurationDtoV2(curation),
              );
            },
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

      return new HomeCurationDtoV2(
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
    return {
      _id: '',
      name: '',
      dday: '',
      ment: '',
      images: [],
    };
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

  async showCuration(curationId: string, page: number) {
    const curation = await this.curationModel.findById(curationId).catch(() => {
      throw new CurationNotFoundException(curationId);
    });

    if (Number.isNaN(page)) page = 0;
    const apiUrl = this.clipApiUrl(
      `/cakes/ko-search-page?keyword=${curation.key}&size=20&page=${page}`,
    );
    this.homeMetrics.countAi();
    const response = await this.httpService
      .get(apiUrl)
      .toPromise()
      .catch((error) => {
        this.homeMetrics.countAiError();
        throw error;
      });
    const cakes = response.data.result;

    const Response = await cakes.map((cake) => new CakeSimpleResponseDto(cake));
    return new CurationCakeResponsDto(curation.description, Response);
  }
}
