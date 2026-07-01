import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PopularCakeRank,
  PopularCakeRankDocument,
} from './entities/popularCakeRank.shema';
import { LogService } from './log.service';
import { HomeResilienceMetricsService } from 'src/home-resilience/home-resilience-metrics.service';

// 기존 cake.service.popular 이 사용하던 집계 날짜 범위를 그대로 유지한다.
const POPULAR_RANK_START_DATE = '2023-01-01';
const POPULAR_RANK_END_DATE = '2023-12-31';
// read model 에 미리 적재해 둘 상위 랭킹 수. standalone 페이지네이션 여유분을 포함한다.
const POPULAR_RANK_TOP_N = 100;
// staleness 임계. 이 시간이 지나면 다음 조회에서 백그라운드 갱신을 1회 트리거한다.
const POPULAR_RANK_TTL_MS = Number(process.env.POPULAR_RANK_TTL_MS ?? 600000);

/**
 * 홈 Popular 섹션 랭킹을 사전 계산 read model 로 제공한다.
 *
 * - 조회 경로(getRanked)는 read model 만 읽고 cakelikelogs 집계를 수행하지 않는다.
 * - 갱신 경로(refresh)는 집계를 1회 수행해 read model 을 교체한다.
 *   refresh 는 추후 @nestjs/schedule cron 에서 그대로 호출할 수 있도록 분리해 두었다.
 *   현재는 SWR(stale-while-revalidate) 방식으로 조회 시 staleness 를 보고 백그라운드 트리거한다.
 */
@Injectable()
export class PopularRankService {
  private refreshing = false;

  constructor(
    @InjectModel(PopularCakeRank.name, 'kezzle')
    private readonly rankModel: Model<PopularCakeRankDocument>,
    private readonly logService: LogService,
    private readonly homeMetrics: HomeResilienceMetricsService,
  ) {}

  /**
   * 사전 계산된 인기 랭킹을 조회한다. (집계 없음)
   * @param after standalone 페이지네이션 커서(total 점수). 홈에서는 NaN.
   * @param limit 가져올 개수. NaN 이면 기본 20.
   */
  async getRanked(after: number, limit: number, maxTimeMs?: number) {
    if (Number.isNaN(limit)) limit = 20;

    this.homeMetrics.countDb();
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
      this.homeMetrics.countDb();
      const refreshedQuery = this.rankModel
        .findOne()
        .sort({ computedAt: -1, rank: 1 });
      if (maxTimeMs !== undefined) {
        refreshedQuery.maxTimeMS(maxTimeMs);
      }
      latest = await refreshedQuery.lean();
      if (!latest) return [];
    }

    const computedAt = latest.computedAt;
    this.maybeRefreshInBackground(computedAt);

    // 항상 최신 배치(computedAt)만 읽어 갱신 중간에 두 배치가 섞이지 않게 한다.
    const filter: Record<string, unknown> = { computedAt };
    if (!Number.isNaN(after)) filter.total = { $lt: after };

    this.homeMetrics.countDb();
    const rankedQuery = this.rankModel
      .find(filter)
      .sort({ rank: 1 })
      .limit(limit);
    if (maxTimeMs !== undefined) {
      rankedQuery.maxTimeMS(maxTimeMs);
    }
    const docs = await rankedQuery.lean();

    // CakeSimpleResponseDto 가 기대하는 형태로 매핑한다(_id, total, image, owner_store_id, tag_ins).
    return docs.map((d) => ({
      _id: d.cakeId,
      total: d.total,
      image: d.image,
      owner_store_id: d.owner_store_id,
      tag_ins: d.tag_ins,
    }));
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
      // 기존 cakelikelogs 집계를 상위 N건만 1회 수행한다(삭제 cake 제외는 getRankCake 에서 처리).
      const ranked = await this.logService.getRankCake(
        POPULAR_RANK_START_DATE,
        POPULAR_RANK_END_DATE,
        NaN,
        POPULAR_RANK_TOP_N,
      );

      const computedAt = new Date();
      const docs = ranked.map((cake: any, index: number) => ({
        rank: index + 1,
        cakeId: cake._id,
        total: cake.total,
        image: cake.image,
        owner_store_id: cake.owner_store_id,
        tag_ins: cake.tag_ins ?? [],
        computedAt,
      }));

      if (docs.length > 0) {
        // 새 배치를 먼저 적재한 뒤 이전 배치를 제거해 조회 빈 구간이 생기지 않게 한다.
        await this.rankModel.insertMany(docs);
        await this.rankModel.deleteMany({ computedAt: { $lt: computedAt } });
      }
    } finally {
      this.refreshing = false;
    }
  }

  // staleness 초과 시 응답 경로를 막지 않고 백그라운드로 갱신을 1회 트리거한다.
  private maybeRefreshInBackground(computedAt?: Date): void {
    if (!computedAt) return;
    const age = Date.now() - new Date(computedAt).getTime();
    if (age <= POPULAR_RANK_TTL_MS) return;
    if (this.refreshing) return;

    this.homeMetrics.countBackgroundRefresh();
    // fire-and-forget (curations 백그라운드 갱신 패턴과 동일). 실패해도 조회는 stale 데이터로 응답한다.
    this.refresh().catch(() => undefined);
  }
}
