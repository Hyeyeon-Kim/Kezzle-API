import { AnniversaryDto } from 'src/anniversary/dto/response-anniversary.dto';
import { PopularCakesResponseDto } from 'src/cake/dto/response-popular-cakes.dto';
import { RankResponseDto } from 'src/search/dto/response-search-rank.dto';
import { CurationDtoV2 } from './response-curation.dto.v2';
import { CakesSimpleResponseDto } from 'src/cake/dto/response-cakes-simple.dto';
import { CakeSimpleResponseDto } from 'src/cake/dto/response-cake-simple.dto';
import { ApiProperty } from '@nestjs/swagger';
import { HomeSectionsMetadataDto } from './home-section-metadata.dto';

export class HomeCurationDtoV2 {
  @ApiProperty({
    description: '기념일 정보',
    type: AnniversaryDto,
  })
  readonly anniversary: AnniversaryDto;

  @ApiProperty({
    description: '추천 케이크들 6개를 반환합니다.',
    type: [CakeSimpleResponseDto],
  })
  readonly recommendCakes: CakeSimpleResponseDto[];

  @ApiProperty({
    description: '인기 케이크들 3개를 반환합니다.',
    type: PopularCakesResponseDto,
  })
  readonly popularCakes: PopularCakesResponseDto;

  @ApiProperty({
    description: '인기 검색어 4개를 반환합니다.',
    type: RankResponseDto,
  })
  readonly keywordRanks: RankResponseDto;

  @ApiProperty({
    description: '최신 케이크들 4개를 반환합니다.',
    type: CakesSimpleResponseDto,
  })
  readonly newestCakes: CakesSimpleResponseDto;

  @ApiProperty({
    description: '큐레이션 4개를 반환합니다.',
    type: [CurationDtoV2],
  })
  readonly curations: CurationDtoV2[];

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

  constructor(
    anniversary: AnniversaryDto,
    recommendCakes: CakeSimpleResponseDto[],
    popularCakes: PopularCakesResponseDto,
    keywordRanks: RankResponseDto,
    newestCakes: CakesSimpleResponseDto,
    curations: CurationDtoV2[],
    degraded: boolean,
    sections: HomeSectionsMetadataDto,
  ) {
    this.anniversary = anniversary;
    this.recommendCakes = recommendCakes;
    this.popularCakes = popularCakes;
    this.keywordRanks = keywordRanks;
    this.newestCakes = newestCakes;
    this.curations = curations;
    this.degraded = degraded;
    this.sections = sections;
  }
}
