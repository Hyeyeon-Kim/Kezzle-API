import { ApiProperty } from '@nestjs/swagger';

export class CatalogSimilarCakeResponseDto {
  @ApiProperty({ description: '케이크 ID(ObjectId)' })
  readonly _id: string;

  @ApiProperty({ type: Object, description: 'Image' })
  readonly image: unknown;

  @ApiProperty({ description: '케이크 소유 매장 ID(ObjectId)' })
  readonly owner_store_id: string;

  @ApiProperty({ description: '케이크 소유 매장 이름' })
  readonly owner_store_name: string;

  @ApiProperty({ description: '케이크 소유 매장 주소' })
  readonly owner_store_address: string;

  @ApiProperty({ type: [String], description: '케이크 소유 매장의 맛' })
  readonly owner_store_taste: readonly string[];

  @ApiProperty({ description: '케이크 소유 매장의 위도' })
  readonly owner_store_latitude: number;

  @ApiProperty({ description: '케이크 소유 매장의 경도' })
  readonly owner_store_longitude: number;

  constructor(data: CatalogSimilarCakeResponseDto) {
    Object.assign(this, data);
  }
}

export class CatalogSimilarCakesResponseDto {
  @ApiProperty({ description: '데이터가 더 있는가' })
  readonly hasMore: boolean;

  @ApiProperty({ type: [CatalogSimilarCakeResponseDto] })
  readonly cakes: CatalogSimilarCakeResponseDto[];

  constructor(cakes: CatalogSimilarCakeResponseDto[], hasMore: boolean) {
    this.cakes = cakes;
    this.hasMore = hasMore;
  }
}
