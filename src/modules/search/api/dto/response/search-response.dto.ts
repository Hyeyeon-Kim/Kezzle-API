import { ApiProperty } from '@nestjs/swagger';
import { Cake } from 'src/modules/cake/application/model/cake';
import { ImageDto } from 'src/platform/http/dto/image.dto';

export class SearchCakeResponseDto {
  @ApiProperty()
  readonly _id: string;

  @ApiProperty({ type: ImageDto })
  readonly image: ImageDto;

  @ApiProperty()
  readonly owner_store_id: string;

  @ApiProperty()
  readonly isLiked: boolean;

  @ApiProperty()
  readonly cursor: string;

  @ApiProperty({ type: [String] })
  readonly hashtag: string[];

  constructor(cake: Cake, viewerId: string) {
    const source = cake as any;
    this._id = source.id ?? source._id;
    this.image = new ImageDto(source.image);
    this.owner_store_id = source.ownerStoreId ?? source.owner_store_id;
    const likedUserIds = source.likedUserIds ?? source.user_like_ids;
    this.isLiked =
      likedUserIds === undefined
        ? source.isLiked ?? false
        : likedUserIds.includes(viewerId);
    this.cursor = source.cursor;
    this.hashtag = [...(source.tags ?? source.hashtag ?? source.tag_ins ?? [])];
  }
}

export class SearchResponseDto {
  @ApiProperty()
  readonly hasMore: boolean;

  @ApiProperty({ required: false })
  readonly nextPage?: number;

  @ApiProperty({ type: [SearchCakeResponseDto] })
  readonly cakes: SearchCakeResponseDto[];

  constructor(
    cakes: SearchCakeResponseDto[],
    hasMore: boolean,
    nextPage?: number,
  ) {
    this.hasMore = hasMore;
    this.nextPage = nextPage;
    this.cakes = cakes;
  }
}
