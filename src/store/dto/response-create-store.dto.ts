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
    const source = store as any;
    this._id = source.id ?? source._id;
    this.name = store.name;
    this.logo =
      store.logo == null
        ? store.logo
        : ImageDto.fromValueOrPersistence(store.logo as never);
    this.store_feature = source.feature ?? source.store_feature;
    this.store_description = source.description ?? source.store_description;
    this.insta_url = source.instagramUrl ?? source.insta_url;
    this.kakako_url = source.kakaoChannelUrl ?? source.kakako_url;
    this.kakao_map_url = source.kakaoMapUrl ?? source.kakao_map_url;
    this.location = source.location?.coordinates
      ? source.location
      : ({
          type: 'Point',
          coordinates: [source.location?.longitude, source.location?.latitude],
        } as never);
    this.address = store.address;
    this.phone_number = source.phoneNumber ?? source.phone_number;
    this.owner_user_id = source.ownerUserId ?? source.owner_user_id;
    const detailImages = (
      source.detailImages ??
      source.detail_images ??
      []
    ).map((image) => ImageDto.fromValueOrPersistence(image));
    this.detail_images = detailImages.length > 0 ? detailImages : undefined;
    this.operating_time = [
      ...(source.operatingTime ?? source.operating_time ?? []),
    ];
    this.user_like_ids = [
      ...(source.likedUserIds ?? source.user_like_ids ?? []),
    ];
    this.taste = [...(source.taste ?? [])];
    this.createdAt = store.createdAt;
    this.updatedAt = store.updatedAt;
  }
}
