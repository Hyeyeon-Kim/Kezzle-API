import { ApiProperty } from '@nestjs/swagger';
import { ImageDto } from 'src/shared/image/api/image.dto';
import { CakeView } from 'src/modules/cake/application/cake.view';
import { PopularRankingView } from '../../application/ranking.view';

class PopularCakeResponseDto {
  @ApiProperty({ description: '케이크 ID(ObjectId)' })
  readonly _id: string;

  @ApiProperty({ type: ImageDto, description: 'Image' })
  readonly image: ImageDto;

  @ApiProperty({ description: '케이크 소유 매장 ID(ObjectId)' })
  readonly owner_store_id: string;

  @ApiProperty({ type: [String], description: 'hashtag' })
  readonly hashtag: string[];

  @ApiProperty({ type: Number, description: '인기도' })
  readonly popular_cal: number;

  constructor(cake: CakeView) {
    this._id = cake.id;
    this.image =
      cake.image == null
        ? (cake.image as unknown as ImageDto)
        : new ImageDto(cake.image);
    this.owner_store_id = cake.ownerStoreId;
    this.hashtag = cake.tags;
    this.popular_cal = cake.calculatedLikes;
  }
}

export class PopularCakesResponseDto {
  @ApiProperty({ description: '시작 날짜', example: '2021-06-01' })
  readonly startDate: string;

  @ApiProperty({ description: '종료 날짜', example: '2021-06-30' })
  readonly endDate: string;

  @ApiProperty({ description: '케이크들', type: [PopularCakeResponseDto] })
  readonly cakes: PopularCakeResponseDto[];

  constructor(view: PopularRankingView) {
    this.startDate = view.startDate;
    this.endDate = view.endDate;
    this.cakes = view.cakes.map((cake) => new PopularCakeResponseDto(cake));
  }
}
