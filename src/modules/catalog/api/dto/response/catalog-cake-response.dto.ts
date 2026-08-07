import { ApiProperty } from '@nestjs/swagger';

export class CatalogCakeResponseDto {
  @ApiProperty({ description: '케이크 ID(ObjectId)' })
  readonly _id: string;

  @ApiProperty({ type: Object, description: 'Image' })
  readonly image: unknown;

  @ApiProperty({ description: '케이크 소유 매장 ID(ObjectId)' })
  readonly owner_store_id: string;

  @ApiProperty({ description: '로그인한 유저의 좋아요 여부' })
  readonly isLiked: boolean;

  @ApiProperty({ description: 'cursor' })
  readonly cursor: string;

  @ApiProperty({ type: [String], description: 'hashtag' })
  readonly hashtag: readonly string[];

  constructor(data: CatalogCakeResponseDto) {
    Object.assign(this, data);
  }
}

export class CatalogCakesResponseDto {
  @ApiProperty({ description: '데이터가 더 있는가' })
  readonly hasMore: boolean;

  @ApiProperty({ type: [CatalogCakeResponseDto], description: '케이크들' })
  readonly cakes: CatalogCakeResponseDto[];

  constructor(cakes: CatalogCakeResponseDto[], hasMore: boolean) {
    this.cakes = cakes;
    this.hasMore = hasMore;
  }
}
