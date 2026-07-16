import { ApiProperty } from '@nestjs/swagger';
import { CatalogCakeResponseDto } from './catalog-cake-response.dto';

export class CatalogStoreResponseDto {
  @ApiProperty({ description: '케이크 매장 ID(ObjectId)' })
  readonly _id: string;

  @ApiProperty({ description: '케이크 매장명' })
  readonly name: string;

  @ApiProperty({ type: Object, description: '케이크 매장 로고 사진' })
  readonly logo: unknown;

  @ApiProperty({ description: '케이크 매장 주소' })
  readonly address: string;

  @ApiProperty({ description: '로그인한 유저의 좋아요 여부' })
  readonly isLiked: boolean;

  @ApiProperty({ description: '매장과 유저 설정 위치 사이 거리' })
  readonly distance: number;

  @ApiProperty({ type: [CatalogCakeResponseDto] })
  readonly cakes: CatalogCakeResponseDto[];

  constructor(data: CatalogStoreResponseDto) {
    Object.assign(this, data);
  }
}

export class CatalogStoresResponseDto {
  @ApiProperty({ description: '데이터가 더 있는가' })
  readonly hasMore: boolean;

  @ApiProperty({ type: [CatalogStoreResponseDto], description: '스토어들' })
  readonly stores: CatalogStoreResponseDto[];

  constructor(stores: CatalogStoreResponseDto[], hasMore: boolean) {
    this.stores = stores;
    this.hasMore = hasMore;
  }
}
