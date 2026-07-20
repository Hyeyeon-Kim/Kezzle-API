import { LogService } from './../log/log.service';
import { KeywordRankService } from './../log/keyword-rank.service';
import {
  computeRankWindow,
  KEYWORD_RANK_WINDOW_DAYS_ENV,
} from './../log/rank-window';
import { CakesResponseDto } from 'src/cake/dto/response-cakes.dto';
import { AuthenticatedUser } from 'src/user/application/authenticated-user';
import { Injectable } from '@nestjs/common';
import { RankResponseDto } from './dto/response-search-rank.dto';
import { LatestResponseDto } from './dto/response-latest-search.dto';
import { CakeResponseDto } from 'src/cake/dto/response-cake.dto';
import { CakesSearchResponseDto } from 'src/cake/dto/response-search-cake.dto';
import { ClipClient } from 'src/ai-search/clip-client';

@Injectable()
export class SearchService {
  constructor(
    private readonly clipClient: ClipClient,
    private readonly logService: LogService,
    private readonly keywordRankService: KeywordRankService,
  ) {}

  async search(keywords: string, page: number, user: AuthenticatedUser) {
    if (!keywords) return new CakesResponseDto([], false);

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
        this.logService.searchlog(user.firebaseUid, word, arr);
      }
    }

    const cakeResponse = result.map(
      (cake) => new CakeResponseDto(cake, user.firebaseUid),
    );
    return new CakesSearchResponseDto(cakeResponse, nextPage, isLastPage);
  }

  async getRank(
    startDate?: string,
    endDate?: string,
    limit?: number,
    maxTimeMs?: number,
  ) {
    // 날짜 지정이 없는 기본 경로(홈 포함)는 사전 집계 read model 을 읽는다.
    if (startDate == null && endDate == null) {
      const ranked = await this.keywordRankService.getRanked(
        limit ?? 10,
        maxTimeMs,
      );
      return new RankResponseDto(
        ranked.ranking,
        ranked.startDate,
        ranked.endDate,
      );
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
    return new RankResponseDto(result, start, end);
  }

  async getLatest(userId: string) {
    const latest = this.logService.getLatestWord(userId);
    const keyword = new Set<string>();
    for (let i = 0; i < 10; i++) keyword.add(latest[i].searchWord);

    const result = Array.from(keyword);
    return new LatestResponseDto(result);
  }
}
