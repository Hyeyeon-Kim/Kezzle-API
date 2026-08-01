import { ApiProperty } from '@nestjs/swagger';
import { ImageDto } from 'src/common/image/api/image.dto';

export class HomeCakeDto {
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

export class HomeCakePageDto {
  @ApiProperty()
  readonly hasMore: boolean;

  @ApiProperty({ type: [HomeCakeDto] })
  readonly cakes: HomeCakeDto[];

  constructor(data: any) {
    this.hasMore = data?.hasMore ?? false;
    this.cakes = (data?.cakes ?? []).map((cake) => new HomeCakeDto(cake));
  }
}

export class HomePopularCakesDto {
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
