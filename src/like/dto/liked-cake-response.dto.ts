import { ApiProperty } from '@nestjs/swagger';

export class LikedCakeResponseDto {
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

  constructor(data: LikedCakeResponseDto) {
    Object.assign(this, data);
  }
}
