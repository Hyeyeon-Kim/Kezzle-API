import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImageDto } from 'src/platform/http/dto/image.dto';
import {
  HomeFeedView,
  HomeSectionMetadataView,
  HomeSectionsView,
} from '../../application/home-feed.view';

class HomeAnniversaryDto {
  @ApiProperty()
  readonly _id: string;

  @ApiProperty()
  readonly name: string;

  @ApiProperty()
  readonly dday: string;

  @ApiProperty()
  readonly ment: string;

  @ApiProperty({ type: [String] })
  readonly images: string[];

  constructor(data: any) {
    this._id = data?.id ?? data?._id;
    this.name = data?.name;
    this.dday = data?.dday;
    this.ment = data?.mention ?? data?.ment;
    this.images = [...(data?.images ?? [])];
  }
}

class HomeCakeDto {
  @ApiProperty()
  readonly _id: string;

  @ApiProperty({ type: ImageDto })
  readonly image: ImageDto;

  @ApiProperty()
  readonly owner_store_id: string;

  @ApiProperty({ type: [String] })
  readonly hashtag?: string[];

  @ApiProperty({ required: false })
  readonly popular_cal?: number;

  constructor(data: any) {
    this._id = data?.id ?? data?._id;
    this.image = data?.image ? new ImageDto(data.image) : data?.image;
    this.owner_store_id = data?.ownerStoreId ?? data?.owner_store_id;
    const tags = data?.tags ?? data?.hashtag ?? data?.tag_ins;
    this.hashtag = tags === undefined ? undefined : [...tags];
    this.popular_cal =
      data != null && 'calculatedLikes' in data
        ? data.calculatedLikes
        : data != null && 'popular_cal' in data
        ? data.popular_cal
        : data?.total;
  }
}

class HomeCakePageDto {
  @ApiProperty()
  readonly hasMore: boolean;

  @ApiProperty({ type: [HomeCakeDto] })
  readonly cakes: HomeCakeDto[];

  constructor(data: any) {
    this.hasMore = data?.hasMore ?? false;
    this.cakes = (data?.cakes ?? []).map((cake) => new HomeCakeDto(cake));
  }
}

class HomePopularCakesDto {
  @ApiProperty()
  readonly startDate: string;

  @ApiProperty()
  readonly endDate: string;

  @ApiProperty({ type: [HomeCakeDto] })
  readonly cakes: HomeCakeDto[];

  constructor(data: any) {
    this.startDate = data?.startDate;
    this.endDate = data?.endDate;
    this.cakes = (data?.cakes ?? []).map((cake) => new HomeCakeDto(cake));
  }
}

class HomeRankItemDto {
  @ApiProperty()
  readonly _id: string;

  @ApiProperty()
  readonly count: number;

  constructor(data: any) {
    this._id = data?.id ?? data?._id;
    this.count = data?.count;
  }
}

class HomeRankDto {
  @ApiProperty({ type: [HomeRankItemDto] })
  readonly ranking: HomeRankItemDto[];

  @ApiProperty()
  readonly startDate: string;

  @ApiProperty()
  readonly endDate: string;

  constructor(data: any) {
    this.ranking = (data?.ranking ?? []).map(
      (item) => new HomeRankItemDto(item),
    );
    this.startDate = data?.startDate;
    this.endDate = data?.endDate;
  }
}

class HomeCurationItemDto {
  @ApiProperty({
    description: '큐레이션 id',
    example: '60f9b0b3e6b3f3b3b4b3b3b3',
  })
  readonly _id: string;

  @ApiProperty({
    description: '큐레이션에 관련한 사진들 url',
    type: [HomeCakeDto],
  })
  readonly cakes: HomeCakeDto[];

  @ApiProperty({
    description: '큐레이션 문구',
    example: '케이크를 좋아하는 사람들을 위한 케이크 모음',
  })
  readonly description: string;

  constructor(data: any) {
    this._id = data?.id ?? data?._id;
    this.cakes = data?.cakes.map((cake) => new HomeCakeDto(cake)).slice(0, 6);
    this.description = data?.key ?? data?.description;
  }
}

class HomeSectionMetadataDto {
  @ApiProperty({ enum: ['success', 'fallback'], example: 'success' })
  readonly status: HomeSectionMetadataView['status'];

  @ApiPropertyOptional({
    enum: ['timeout', 'dependency_error'],
    example: 'timeout',
  })
  readonly reason?: HomeSectionMetadataView['reason'];

  @ApiProperty({ description: '섹션 처리 시간(ms)', example: 12.34 })
  readonly durationMs: number;

  constructor(result: HomeSectionMetadataView) {
    this.status = result.status;
    this.durationMs = result.durationMs;
    if (result.status === 'fallback') {
      this.reason = result.reason;
    }
  }
}

class HomeSectionsMetadataDto {
  @ApiProperty({ type: HomeSectionMetadataDto })
  readonly recommendCakes: HomeSectionMetadataDto;

  @ApiProperty({ type: HomeSectionMetadataDto })
  readonly anniversary: HomeSectionMetadataDto;

  @ApiProperty({ type: HomeSectionMetadataDto })
  readonly popularCakes: HomeSectionMetadataDto;

  @ApiProperty({ type: HomeSectionMetadataDto })
  readonly keywordRanks: HomeSectionMetadataDto;

  @ApiProperty({ type: HomeSectionMetadataDto })
  readonly newestCakes: HomeSectionMetadataDto;

  @ApiProperty({ type: HomeSectionMetadataDto })
  readonly curations: HomeSectionMetadataDto;

  constructor(results: HomeSectionsView) {
    this.recommendCakes = new HomeSectionMetadataDto(results.recommendCakes);
    this.anniversary = new HomeSectionMetadataDto(results.anniversary);
    this.popularCakes = new HomeSectionMetadataDto(results.popularCakes);
    this.keywordRanks = new HomeSectionMetadataDto(results.keywordRanks);
    this.newestCakes = new HomeSectionMetadataDto(results.newestCakes);
    this.curations = new HomeSectionMetadataDto(results.curations);
  }
}

export class HomeFeedResponseDto {
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

  constructor(view: HomeFeedView) {
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
