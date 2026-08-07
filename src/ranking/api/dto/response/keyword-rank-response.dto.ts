import { ApiProperty } from '@nestjs/swagger';
import { KeywordRankingView } from 'src/ranking/application/query/ranking.view';

class KeywordRankItemResponseDto {
  @ApiProperty({ description: '키워드', example: '스마일' })
  readonly _id: string;

  @ApiProperty({ description: '검색 횟수', example: 30 })
  readonly count: number;

  constructor(data: { id: string; count: number }) {
    this._id = data.id;
    this.count = data.count;
  }
}

export class KeywordRankResponseDto {
  @ApiProperty({
    description: '키워드 랭킹 목록',
    type: [KeywordRankItemResponseDto],
  })
  readonly ranking: KeywordRankItemResponseDto[];

  @ApiProperty({ description: '검색 시작 날짜', example: '2021-06-01' })
  readonly startDate: string;

  @ApiProperty({ description: '검색 종료 날짜', example: '2021-06-30' })
  readonly endDate: string;

  constructor(view: KeywordRankingView) {
    this.ranking = view.ranking.map(
      (item) => new KeywordRankItemResponseDto(item),
    );
    this.startDate = view.startDate;
    this.endDate = view.endDate;
  }
}
