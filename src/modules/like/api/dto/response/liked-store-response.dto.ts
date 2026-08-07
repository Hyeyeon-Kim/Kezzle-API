import { ApiProperty } from '@nestjs/swagger';
import { LikedCakeResponseDto } from './liked-cake-response.dto';

export class LikedStoreResponseDto {
  @ApiProperty({ description: '케이크 매장 ID(ObjectId)' })
  readonly _id: string;

  @ApiProperty({ description: '케이크 매장명' })
  readonly name: string;

  @ApiProperty({ type: Object, required: false })
  readonly logo: unknown;

  @ApiProperty({ description: '케이크 매장 주소' })
  readonly address: string;

  @ApiProperty({ description: '로그인한 유저의 좋아요 여부' })
  readonly isLiked: boolean;

  @ApiProperty({ type: [LikedCakeResponseDto] })
  readonly cakes: LikedCakeResponseDto[];

  constructor(data: LikedStoreResponseDto) {
    Object.assign(this, data);
  }
}
