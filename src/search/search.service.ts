import { KeywordRankService } from './../log/keyword-rank.service';
import {
  computeRankWindow,
  KEYWORD_RANK_WINDOW_DAYS_ENV,
} from './../log/rank-window';
import { Injectable, Logger } from '@nestjs/common';
import { ClipClient } from 'src/ai-search/clip-client';
import { CakeExternalMapper } from 'src/cake/cake-external.mapper';
import { MetricsService } from 'src/metrics/metrics.service';
import { KeywordEventReader } from './application/port/keyword-event.reader';
import { SearchEventRecorder } from './application/port/search-event-recorder.port';
import { SearchHistoryReader } from './application/port/search-history.reader';
import {
  LatestSearchView,
  SearchRankView,
  SearchResultView,
} from './application/search.view';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly clipClient: ClipClient,
    private readonly searchEventRecorder: SearchEventRecorder,
    private readonly searchHistoryReader: SearchHistoryReader,
    private readonly keywordEventReader: KeywordEventReader,
    private readonly keywordRankService: KeywordRankService,
    private readonly metricsService: MetricsService,
  ) {}

  async search(
    keywords: string,
    page: number,
    userId: string,
  ): Promise<SearchResultView> {
    if (!keywords) return { cakes: [], hasMore: false };

    const { result, nextPage, isLastPage } = await this.clipClient.koSearchPage(
      keywords,
      18,
      page,
    );

    if (page === 0 || page === undefined) {
      const keywordArr = keywords.split(',').map((keyword) => keyword.trim());
      for (let i = 0; i < keywordArr.length; i++) {
        const word = keywordArr[i];
        const arr = [...keywordArr.slice(0, i), ...keywordArr.slice(i + 1)];
        void this.searchEventRecorder
          .record(userId, word, arr)
          .catch((error: unknown) => this.reportRecordFailure(error));
      }
    }

    return {
      cakes: result.map((cake) => CakeExternalMapper.toView(cake)),
      nextPage,
      hasMore: !isLastPage,
    };
  }

  async getRank(
    startDate?: string,
    endDate?: string,
    limit?: number,
    maxTimeMs?: number,
  ): Promise<SearchRankView> {
    // 날짜 지정이 없는 기본 경로(홈 포함)는 사전 집계 read model 을 읽는다.
    if (startDate == null && endDate == null) {
      const ranked = await this.keywordRankService.getRanked(
        limit ?? 10,
        maxTimeMs,
      );
      return {
        ranking: ranked.ranking.map((item) => ({
          id: item._id,
          count: item.count,
        })),
        startDate: ranked.startDate,
        endDate: ranked.endDate,
      };
    }

    // 명시적 날짜가 있는 관리용 경로는 기존 실시간 집계를 유지한다.
    const window = computeRankWindow(KEYWORD_RANK_WINDOW_DAYS_ENV);
    const start = startDate ?? window.startDate;
    const end = endDate ?? window.endDate;
    const result = await this.keywordEventReader.getRanked(
      start,
      end,
      limit,
      maxTimeMs,
    );
    return {
      ranking: result.map((item) => ({ id: item._id, count: item.count })),
      startDate: start,
      endDate: end,
    };
  }

  async getLatest(userId: string): Promise<LatestSearchView> {
    const latest = await this.searchHistoryReader.findLatest(userId);
    const keyword = new Set<string>();
    for (const entry of latest.slice(0, 10)) {
      if (entry?.searchWord) keyword.add(entry.searchWord);
    }

    const result = Array.from(keyword);
    return { keywords: result };
  }

  private reportRecordFailure(error: unknown): void {
    this.metricsService.searchEventRecordFailures.inc();
    this.logger.error({
      event: 'search_event_record_failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
