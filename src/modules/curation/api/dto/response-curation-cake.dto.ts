import { ApiProperty } from '@nestjs/swagger';
import { ImageDto } from 'src/shared/image/api/image.dto';

export class CurationCakeResponseDto {
  @ApiProperty()
  readonly _id: string;

  @ApiProperty({ type: ImageDto })
  readonly image: ImageDto;

  @ApiProperty()
  readonly owner_store_id: string;

  @ApiProperty({ type: [String] })
  readonly hashtag: string[];

  @ApiProperty({ required: false })
  readonly popular_cal?: number;

  constructor(data: any) {
    this._id = data?.id ?? data?._id;
    this.image = new ImageDto(data.image);
    this.owner_store_id = data?.ownerStoreId ?? data?.owner_store_id;
    this.hashtag = [...(data?.tags ?? data?.hashtag ?? data?.tag_ins ?? [])];
    this.popular_cal =
      data != null && 'calculatedLikes' in data
        ? data.calculatedLikes
        : data?.popular_cal;
  }
}

export class CurationCakeResponsDto {
  @ApiProperty({
    description: '큐레이션 문구',
  })
  readonly description: string;

  @ApiProperty({
    description: '큐레이션 해당 케이크들',
  })
  readonly cakes: CurationCakeResponseDto[];

  constructor(description: string, data: CurationCakeResponseDto[]) {
    this.description = description;
    this.cakes = data;
  }
}
