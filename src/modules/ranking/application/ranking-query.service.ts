import { Inject, Injectable } from '@nestjs/common';
import { CakeExternalMapper } from 'src/modules/cake/infrastructure/cake-external.mapper';
import { KeywordEventReader } from 'src/modules/search/application/port/keyword-event.reader';
import { KeywordRankingView, PopularRankingView } from './ranking.view';
import { KeywordRankService } from '../infrastructure/persistence/keyword-rank.service';
import { PopularRankService } from '../infrastructure/persistence/popular-rank.service';
import { computeRankWindow } from './rank-window';
import { ConfigType } from '@nestjs/config';
import rankingConfig from 'src/platform/config/ranking.config';

@Injectable()
export class RankingQueryService {
  constructor(
    private readonly keywordRankService: KeywordRankService,
    private readonly popularRankService: PopularRankService,
    private readonly keywordEventReader: KeywordEventReader,
    @Inject(rankingConfig.KEY)
    private readonly config: ConfigType<typeof rankingConfig>,
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
    const window = computeRankWindow(this.config.keywordWindowDays);
    return {
      ranking: [],
      startDate: window.startDate,
      endDate: window.endDate,
    };
  }

  getPopularFallback(): PopularRankingView {
    const window = computeRankWindow(this.config.popularWindowDays);
    return {
      cakes: [],
      startDate: window.startDate,
      endDate: window.endDate,
    };
  }
}
