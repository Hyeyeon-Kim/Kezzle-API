import { ApiProperty } from '@nestjs/swagger';
import { LocationDto } from './response-location.dto';
import { StoreView } from '../application/store.view';
import { ImageDto } from 'src/common/image/api/image.dto';

export class CreateStoreResponseDto {
  @ApiProperty({ description: '생성된 매장 ID(ObjectId)' })
  readonly _id: string;

  @ApiProperty({ description: '케이크 매장명' })
  readonly name: string;

  @ApiProperty({ type: Object, required: false })
  readonly logo?: unknown;

  @ApiProperty({ required: false })
  readonly store_feature?: string;

  @ApiProperty({ required: false })
  readonly store_description?: string;

  @ApiProperty({ required: false })
  readonly insta_url?: string;

  @ApiProperty({ required: false })
  readonly kakako_url?: string;

  @ApiProperty({ required: false })
  readonly kakao_map_url?: string;

  @ApiProperty({ type: LocationDto })
  readonly location: LocationDto;

  @ApiProperty()
  readonly address: string;

  @ApiProperty({ required: false })
  readonly phone_number?: string;

  @ApiProperty()
  readonly owner_user_id: string;

  @ApiProperty({ type: [Object], required: false })
  readonly detail_images?: unknown[];

  @ApiProperty({ type: [String] })
  readonly operating_time: string[];

  @ApiProperty({ type: [String] })
  readonly user_like_ids: string[];

  @ApiProperty({ type: [String] })
  readonly taste: string[];

  @ApiProperty({ type: String, format: 'date-time' })
  readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  readonly updatedAt: Date;

  constructor(store: StoreView) {
    this._id = store.id;
    this.name = store.name;
    this.logo =
      store.logo == null ? store.logo : new ImageDto(store.logo);
    this.store_feature = store.feature;
    this.store_description = store.description;
    this.insta_url = store.instagramUrl;
    this.kakako_url = store.kakaoChannelUrl;
    this.kakao_map_url = store.kakaoMapUrl;
    this.location = {
      type: 'Point',
      coordinates: [store.location?.longitude, store.location?.latitude],
    } as never;
    this.address = store.address;
    this.phone_number = store.phoneNumber;
    this.owner_user_id = store.ownerUserId;
    this.detail_images = store.detailImages.map((image) => new ImageDto(image));
    this.operating_time = [...store.operatingTime];
    this.user_like_ids = [...store.likedUserIds];
    this.taste = [...store.taste];
    this.createdAt = store.createdAt;
    this.updatedAt = store.updatedAt;
  }
}
