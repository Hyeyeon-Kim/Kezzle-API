import { Injectable } from '@nestjs/common';
import { CakeExternalMapper } from 'src/cake/cake-external.mapper';
import { KeywordEventReader } from 'src/search/application/port/keyword-event.reader';
import {
  KeywordRankingView,
  PopularRankingView,
} from './application/ranking.view';
import { KeywordRankService } from './keyword-rank.service';
import { PopularRankService } from './popular-rank.service';
import {
  computeRankWindow,
  KEYWORD_RANK_WINDOW_DAYS_ENV,
  POPULAR_RANK_WINDOW_DAYS_ENV,
} from './rank-window';

@Injectable()
export class RankingQueryService {
  constructor(
    private readonly keywordRankService: KeywordRankService,
    private readonly popularRankService: PopularRankService,
    private readonly keywordEventReader: KeywordEventReader,
  ) {}

  async getKeywordRank(
    startDate?: string,
    endDate?: string,
    limit?: number,
    maxTimeMs?: number,
  ): Promise<KeywordRankingView> {
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

    const fallback = this.getKeywordFallback();
    const start = startDate ?? fallback.startDate;
    const end = endDate ?? fallback.endDate;
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

  async getPopularCakes(
    after: number,
    limit: number,
    maxTimeMs?: number,
  ): Promise<PopularRankingView> {
    const ranked = await this.popularRankService.getRanked(
      after,
      limit,
      maxTimeMs,
    );
    return {
      cakes: ranked.cakes.map((cake) => CakeExternalMapper.toView(cake)),
      startDate: ranked.startDate,
      endDate: ranked.endDate,
    };
  }

  getKeywordFallback(): KeywordRankingView {
    const window = computeRankWindow(KEYWORD_RANK_WINDOW_DAYS_ENV);
    return {
      ranking: [],
      startDate: window.startDate,
      endDate: window.endDate,
    };
  }

  getPopularFallback(): PopularRankingView {
    const window = computeRankWindow(POPULAR_RANK_WINDOW_DAYS_ENV);
    return {
      cakes: [],
      startDate: window.startDate,
      endDate: window.endDate,
    };
  }
}
