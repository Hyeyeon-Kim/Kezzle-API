import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PopularRankingSourceReader } from 'src/modules/ranking/application/port/popular-ranking-source.reader';
import { PopularCakeRank } from 'src/modules/ranking/infrastructure/persistence/popular-cake-rank.schema';
import {
  computeRankWindow,
  toDateString,
} from 'src/modules/ranking/application/query/rank-window';
import { ConfigType } from '@nestjs/config';
import rankingConfig from 'src/platform/config/ranking.config';
import { PopularRankReadModelPort } from 'src/modules/ranking/application/port/popular-rank-read-model.port';
import {
  ExternalImageContract,
  ImageExternalMapper,
} from 'src/shared/image/application/image-external.mapper';

// 대표 fixture의 대규모 동점 score bucket 뒤 다음 page까지 포함하되 source/read model은 bounded 상태를 유지한다.
const POPULAR_RANK_TOP_N = 1000;
/**
 * 홈 Popular 섹션 랭킹을 사전 계산 read model 로 제공한다.
 *
 * - 조회 경로(getRanked)는 read model 만 읽고 cakelikelogs 집계를 수행하지 않는다.
 * - 갱신 경로(refresh)는 집계를 1회 수행해 read model 을 교체한다.
 *   refresh 는 추후 @nestjs/schedule cron 에서 그대로 호출할 수 있도록 분리해 두었다.
 *   현재는 SWR(stale-while-revalidate) 방식으로 조회 시 staleness 를 보고 백그라운드 트리거한다.
 */
@Injectable()
export class PopularRankService implements PopularRankReadModelPort {
  private refreshing = false;

  constructor(
    @InjectModel(PopularCakeRank.name, 'kezzle')
    private readonly rankModel: Model<PopularCakeRank>,
    private readonly sourceReader: PopularRankingSourceReader,
    @Inject(rankingConfig.KEY)
    private readonly config: ConfigType<typeof rankingConfig>,
  ) {}

  /**
   * 사전 계산된 인기 랭킹을 조회한다. (집계 없음)
   * @param after standalone 페이지네이션 커서(total 점수). 홈에서는 NaN.
   * @param limit 가져올 개수. NaN 이면 기본 20.
   */
  async getRanked(after: number, limit: number, maxTimeMs?: number) {
    if (Number.isNaN(limit)) limit = 20;

    const latestQuery = this.rankModel
      .findOne()
      .sort({ computedAt: -1, rank: 1 });
    if (maxTimeMs !== undefined) {
      latestQuery.maxTimeMS(maxTimeMs);
    }
    let latest = await latestQuery.lean();

    // 콜드 스타트: read model 이 비어 있으면 1회 동기 빌드 후 다시 조회한다.
    if (!latest) {
      await this.refresh();
      const refreshedQuery = this.rankModel
        .findOne()
        .sort({ computedAt: -1, rank: 1 });
      if (maxTimeMs !== undefined) {
        refreshedQuery.maxTimeMS(maxTimeMs);
      }
      latest = await refreshedQuery.lean();
      if (!latest) {
        // window 내 로그가 없어 배치가 비었다. 빈 랭킹을 정상 응답한다.
        const window = computeRankWindow(this.config.popularWindowDays);
        return {
          cakes: [],
          startDate: window.startDate,
          endDate: window.endDate,
        };
      }
    }

    const computedAt = latest.computedAt;
    this.maybeRefreshInBackground(computedAt);

    // 항상 최신 배치(computedAt)만 읽어 갱신 중간에 두 배치가 섞이지 않게 한다.
    const filter: Record<string, unknown> = {
      computedAt,
      isEmptyBatch: { $ne: true },
    };
    if (!Number.isNaN(after)) filter.total = { $lt: after };

    const rankedQuery = this.rankModel
      .find(filter)
      .sort({ rank: 1 })
      .limit(limit);
    if (maxTimeMs !== undefined) {
      rankedQuery.maxTimeMS(maxTimeMs);
    }
    const docs = await rankedQuery.lean();

    return {
      cakes: docs.map((d) => ({
        id: String(d.cakeId),
        image:
          d.image == null
            ? undefined
            : ImageExternalMapper.toValue(d.image as ExternalImageContract),
        likedUserIds: [],
        ownerStoreId: d.owner_store_id,
        tags: [...(d.tag_ins ?? [])],
        calculatedLikes: d.total,
        isDeleted: false,
      })),
      ...this.windowStrings(latest),
    };
  }

  // 이전 버전 배치에는 window 필드가 없을 수 있어 현재 window 로 대체한다.
  private windowStrings(latest: { windowStart?: Date; windowEnd?: Date }): {
    startDate: string;
    endDate: string;
  } {
    if (latest.windowStart && latest.windowEnd) {
      return {
        startDate: toDateString(new Date(latest.windowStart)),
        endDate: toDateString(new Date(latest.windowEnd)),
      };
    }
    const window = computeRankWindow(this.config.popularWindowDays);
    return { startDate: window.startDate, endDate: window.endDate };
  }

  /**
   * 인기 랭킹 read model 을 재계산해 교체한다.
   *
   * 이 메서드가 "갱신 단위"이다. 지금은 SWR 에서 백그라운드로 호출하지만,
   * 추후 cron 으로 전환할 때 스케줄러가 이 메서드만 그대로 호출하면 된다.
   * 중복 실행은 in-process 플래그로 방지한다.
   */
  async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      const window = computeRankWindow(this.config.popularWindowDays);
      const ranked = await this.sourceReader.findTop({
        start: window.start,
        end: window.end,
        limit: POPULAR_RANK_TOP_N,
        maxTimeMs: this.config.popularSourceMaxTimeMs,
      });

      const computedAt = new Date();
      const docs = ranked.map((cake, index) => ({
        rank: index + 1,
        cakeId: cake.cakeId,
        total: cake.total,
        image: cake.image,
        owner_store_id: cake.ownerStoreId,
        tag_ins: [...cake.tags],
        windowStart: window.start,
        windowEnd: window.end,
        computedAt,
      }));

      // 빈 집계도 최신 window로 기록해 과거 배치를 재노출하거나 refresh를 반복하지 않는다.
      const batch =
        docs.length > 0
          ? docs
          : [
              {
                windowStart: window.start,
                windowEnd: window.end,
                computedAt,
                isEmptyBatch: true,
              },
            ];

      // 새 배치를 먼저 적재한 뒤 이전 배치를 제거해 조회 빈 구간이 생기지 않게 한다.
      await this.rankModel.insertMany(batch);
      await this.rankModel.deleteMany({ computedAt: { $lt: computedAt } });
    } finally {
      this.refreshing = false;
    }
  }

  // staleness 초과 시 응답 경로를 막지 않고 백그라운드로 갱신을 1회 트리거한다.
  private maybeRefreshInBackground(computedAt?: Date): void {
    if (!computedAt) return;
    const age = Date.now() - new Date(computedAt).getTime();
    if (age <= this.config.popularTtlMs) return;
    if (this.refreshing) return;

    // fire-and-forget (curations 백그라운드 갱신 패턴과 동일). 실패해도 조회는 stale 데이터로 응답한다.
    this.refresh().catch(() => undefined);
  }
}
