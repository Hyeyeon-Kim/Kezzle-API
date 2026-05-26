import { LogService } from './../log/log.service';
import { CakesResponseDto } from 'src/cake/dto/response-cakes.dto';
import IUser from 'src/user/interfaces/user.interface';
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
  ) {}

  async search(keywords: string, page: number, user: IUser) {
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
    startDate: string = '2023-01-01',
    endDate: string = '2023-11-25',
    limit?: number,
  ) {
    const result = await this.logService.getRankWord(startDate, endDate, limit);
    return new RankResponseDto(result, startDate, endDate);
  }

  async getLatest(userId: string) {
    const latest = this.logService.getLatestWord(userId);
    const keyword = new Set<string>();
    for (let i = 0; i < 10; i++) keyword.add(latest[i].searchWord);

    const result = Array.from(keyword);
    return new LatestResponseDto(result);
  }
}
