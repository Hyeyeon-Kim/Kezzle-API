import { ApiProperty } from '@nestjs/swagger';
import { ImageDto } from 'src/common/image/api/image.dto';

export class CakeSimpleResponseDto {
  @ApiProperty({
    description: '케이크 ID(ObjectId)',
    example: '60b4d1b3e6b0b3001b9b9b9b',
  })
  readonly _id: string;

  @ApiProperty({ type: ImageDto, description: 'Image' })
  readonly image: ImageDto;

  @ApiProperty({ type: String, description: '케이크 소유 매장 ID(ObjectId)' })
  readonly owner_store_id: string;

  @ApiProperty({
    type: Boolean,
    description: 'hashtag',
    example: true,
  })
  readonly hashtag: string[];

  @ApiProperty({
    type: Number,
    description: '인기도',
    example: 100,
  })
  readonly popular_cal: number;

  constructor(data: any) {
    this._id = data?.id === undefined ? data?._id : data?.id;
    this.image = data?.image ? new ImageDto(data.image) : data?.image;
    this.owner_store_id = data?.ownerStoreId ?? data?.owner_store_id;
    this.hashtag = data?.tags ?? data?.hashtag ?? data?.tag_ins;
    this.popular_cal =
      data != null && 'calculatedLikes' in data
        ? data.calculatedLikes
        : data != null && 'popular_cal' in data
        ? data.popular_cal
        : data?.total;
  }
}
