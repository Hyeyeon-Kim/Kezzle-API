import { LogService } from './../log/log.service';
import { KeywordRankService } from './../log/keyword-rank.service';
import {
  computeRankWindow,
  KEYWORD_RANK_WINDOW_DAYS_ENV,
} from './../log/rank-window';
import { Injectable } from '@nestjs/common';
import { ClipClient } from 'src/ai-search/clip-client';
import { CakeExternalMapper } from 'src/cake/cake-external.mapper';
import {
  LatestSearchView,
  SearchRankView,
  SearchResultView,
} from './application/search.view';

@Injectable()
export class SearchService {
  constructor(
    private readonly clipClient: ClipClient,
    private readonly logService: LogService,
    private readonly keywordRankService: KeywordRankService,
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
        this.logService.searchlog(userId, word, arr);
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
    const result = await this.logService.getRankWord(
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
    const latest = await this.logService.getLatestWord(userId);
    const keyword = new Set<string>();
    for (const entry of latest.slice(0, 10)) {
      if (entry?.searchWord) keyword.add(entry.searchWord);
    }

    const result = Array.from(keyword);
    return { keywords: result };
  }
}
