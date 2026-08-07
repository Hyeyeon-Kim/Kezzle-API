import { ApiProperty } from '@nestjs/swagger';
import { ImageDto } from 'src/platform/http/dto/image.dto';

export class CakeResponseDto {
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
    description: '로그인한 유저가 좋아요 눌렀는지',
    example: true,
  })
  readonly isLiked: boolean;

  @ApiProperty({
    type: String,
    description: 'cursor',
    example: '0123456789',
  })
  readonly cursor: string;

  @ApiProperty({
    description: 'hashtag',
    example: ['케이크', '초코'],
  })
  readonly hashtag: string[];

  constructor(data: any, userId: string) {
    this._id = data?.id ?? data?._id;
    this.image = data?.image ? new ImageDto(data.image) : data?.image;
    this.owner_store_id = data?.ownerStoreId ?? data?.owner_store_id;
    const likedUserIds = data?.likedUserIds ?? data?.user_like_ids ?? [];
    this.isLiked =
      data?.likedUserIds === undefined && data?.user_like_ids === undefined
        ? data?.isLiked ?? false
        : likedUserIds.includes(userId);
    this.cursor = data?.cursor;
    this.hashtag = data?.tags ?? data?.hashtag ?? data?.tag_ins;
  }
}
