import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { KeywordRank, KeywordRankDocument } from './entities/keywordRank.shema';
import { LogService } from './log.service';
import {
  computeRankWindow,
  KEYWORD_RANK_WINDOW_DAYS_ENV,
  toDateString,
} from './rank-window';

// read model 에 미리 적재해 둘 상위 랭킹 수. 홈 필요량(4)보다 여유를 둔다.
const KEYWORD_RANK_TOP_N = 20;
// staleness 임계. 이 시간이 지나면 다음 조회에서 백그라운드 갱신을 1회 트리거한다.
const KEYWORD_RANK_TTL_MS = Number(process.env.KEYWORD_RANK_TTL_MS ?? 600000);

export type RankedKeywords = {
  ranking: { _id: string; count: number }[];
  startDate: string;
  endDate: string;
};

/**
 * 홈 keywordRanks 섹션 랭킹을 사전 계산 read model 로 제공한다.
 * popular-rank.service 와 동일한 SWR 패턴이다.
 *
 * - 조회 경로(getRanked)는 read model 만 읽고 keywordlogs 집계를 수행하지 않는다.
 * - 갱신 경로(refresh)는 rolling window 기준 집계를 1회 수행해 read model 을 교체한다.
 *   refresh 는 추후 @nestjs/schedule cron 에서 그대로 호출할 수 있도록 분리해 두었다.
 */
@Injectable()
export class KeywordRankService {
  private refreshing = false;

  constructor(
    @InjectModel(KeywordRank.name, 'kezzle')
    private readonly rankModel: Model<KeywordRankDocument>,
    private readonly logService: LogService,
  ) {}

  /**
   * 사전 계산된 인기 검색어 랭킹을 조회한다. (집계 없음)
   */
  async getRanked(limit: number, maxTimeMs?: number): Promise<RankedKeywords> {
    if (!Number.isFinite(limit) || limit <= 0) limit = 10;

    let latest = await this.latestQuery(maxTimeMs).lean();

    // 콜드 스타트: read model 이 비어 있으면 1회 동기 빌드 후 다시 조회한다.
    if (!latest) {
      await this.refresh();
      latest = await this.latestQuery(maxTimeMs).lean();
      if (!latest) {
        // window 내 로그가 없어 배치가 비었다. 빈 랭킹을 정상 응답한다.
        const window = computeRankWindow(KEYWORD_RANK_WINDOW_DAYS_ENV);
        return {
          ranking: [],
          startDate: window.startDate,
          endDate: window.endDate,
        };
      }
    }

    this.maybeRefreshInBackground(latest.computedAt);

    // 항상 최신 배치(computedAt)만 읽어 갱신 중간에 두 배치가 섞이지 않게 한다.
    const rankedQuery = this.rankModel
      .find({ computedAt: latest.computedAt, isEmptyBatch: { $ne: true } })
      .sort({ rank: 1 })
      .limit(limit);
    if (maxTimeMs !== undefined) {
      rankedQuery.maxTimeMS(maxTimeMs);
    }
    const docs = await rankedQuery.lean();

    return {
      ranking: docs.map((doc) => ({ _id: doc.searchWord, count: doc.count })),
      ...this.windowStrings(latest),
    };
  }

  /**
   * 인기 검색어 read model 을 rolling window 기준으로 재계산해 교체한다.
   * 추후 cron 전환 시 스케줄러가 이 메서드만 그대로 호출하면 된다.
   */
  async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      const window = computeRankWindow(KEYWORD_RANK_WINDOW_DAYS_ENV);
      const ranked = await this.logService.getRankWord(
        window.start.toISOString(),
        window.end.toISOString(),
        KEYWORD_RANK_TOP_N,
      );

      const computedAt = new Date();
      const docs = ranked.map(
        (word: { _id: string; count: number }, index: number) => ({
          rank: index + 1,
          searchWord: word._id,
          count: word.count,
          windowStart: window.start,
          windowEnd: window.end,
          computedAt,
        }),
      );

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

  private latestQuery(maxTimeMs?: number) {
    const query = this.rankModel.findOne().sort({ computedAt: -1, rank: 1 });
    if (maxTimeMs !== undefined) {
      query.maxTimeMS(maxTimeMs);
    }
    return query;
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
    const window = computeRankWindow(KEYWORD_RANK_WINDOW_DAYS_ENV);
    return { startDate: window.startDate, endDate: window.endDate };
  }

  // staleness 초과 시 응답 경로를 막지 않고 백그라운드로 갱신을 1회 트리거한다.
  private maybeRefreshInBackground(computedAt?: Date): void {
    if (!computedAt) return;
    const age = Date.now() - new Date(computedAt).getTime();
    if (age <= KEYWORD_RANK_TTL_MS) return;
    if (this.refreshing) return;

    // fire-and-forget. 실패해도 조회는 stale 데이터로 응답한다.
    this.refresh().catch(() => undefined);
  }
}
