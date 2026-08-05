import { ApiProperty } from '@nestjs/swagger';
import { HomeView } from '../../application/home.view';
import { HomeAnniversaryDto } from './home-anniversary.dto';
import {
  HomeCakeDto,
  HomeCakePageDto,
  HomePopularCakesDto,
} from './home-cake.dto';
import { HomeRankDto } from './home-rank.dto';
import { HomeCurationItemDto } from './home-curation.dto';
import { HomeSectionsMetadataDto } from './home-section-metadata.dto';

export class HomeResponseDto {
  @ApiProperty({ description: '기념일 정보', type: HomeAnniversaryDto })
  readonly anniversary: HomeAnniversaryDto;

  @ApiProperty({
    description: '추천 케이크들 6개를 반환합니다.',
    type: [HomeCakeDto],
  })
  readonly recommendCakes: HomeCakeDto[];

  @ApiProperty({
    description: '인기 케이크들 3개를 반환합니다.',
    type: HomePopularCakesDto,
  })
  readonly popularCakes: HomePopularCakesDto;

  @ApiProperty({
    description: '인기 검색어 4개를 반환합니다.',
    type: HomeRankDto,
  })
  readonly keywordRanks: HomeRankDto;

  @ApiProperty({
    description: '최신 케이크들 4개를 반환합니다.',
    type: HomeCakePageDto,
  })
  readonly newestCakes: HomeCakePageDto;

  @ApiProperty({
    description: '큐레이션 4개를 반환합니다.',
    type: [HomeCurationItemDto],
  })
  readonly curations: HomeCurationItemDto[];

  @ApiProperty({
    description: '하나 이상의 홈 섹션이 fallback 응답인지 여부',
    example: false,
  })
  readonly degraded: boolean;

  @ApiProperty({
    description: '홈 섹션별 실행 상태',
    type: HomeSectionsMetadataDto,
  })
  readonly sections: HomeSectionsMetadataDto;

  constructor(view: HomeView) {
    this.anniversary = new HomeAnniversaryDto(view.anniversary);
    this.recommendCakes = view.recommendCakes.map(
      (cake) => new HomeCakeDto(cake),
    );
    this.popularCakes = new HomePopularCakesDto(view.popularCakes);
    this.keywordRanks = new HomeRankDto(view.keywordRanks);
    this.newestCakes = new HomeCakePageDto(view.newestCakes);
    this.curations = view.curations.map(
      (curation) => new HomeCurationItemDto(curation),
    );
    this.degraded = view.degraded;
    this.sections = new HomeSectionsMetadataDto(view.sections);
  }
}
