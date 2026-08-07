import { ImageDto } from 'src/platform/http/dto/image.dto';
import {
  CreateStoreData,
  UpdateStoreData,
} from 'src/modules/store/application/store.command';
import { StoreView } from 'src/modules/store/application/store.view';
import { CreateStoreDto } from 'src/modules/store/api/dto/request/create-store.dto';
import { CreateStoreResponseDto } from './dto/response/create-store-response.dto';
import { DetailStoreResponseDto } from './dto/response/detail-store-response.dto';
import { UpdateStoreDto } from 'src/modules/store/api/dto/request/update-store.dto';

export class StorePresenter {
  static toCreateData(dto: CreateStoreDto): CreateStoreData {
    return {
      name: dto.name,
      logo: dto.logo ? ImageDto.toValue(dto.logo) : undefined,
      feature: dto.store_feature,
      description: dto.store_description,
      instagramUrl: dto.insta_url,
      kakaoChannelUrl: dto.kakako_url,
      location: this.toLocation(dto.location),
      address: dto.address,
      phoneNumber: dto.phone_number,
      ownerUserId: dto.owner_user_id,
      detailImages: dto.detailImages?.map((image) => ImageDto.toValue(image)),
      operatingTime: dto.operating_time,
      taste: dto.taste,
    };
  }

  static toUpdateData(dto: UpdateStoreDto): UpdateStoreData {
    return {
      feature: dto.store_feature,
      description: dto.store_description,
      instagramUrl: dto.insta_url,
      kakaoChannelUrl: dto.kakako_url,
      location: dto.location ? this.toLocation(dto.location) : undefined,
      address: dto.address,
      phoneNumber: dto.phone_number,
      detailImages: dto.detail_images?.map((image) => ImageDto.toValue(image)),
      operatingTime: dto.operating_time,
      taste: dto.taste,
    };
  }

  static created(store: StoreView): CreateStoreResponseDto {
    return new CreateStoreResponseDto(store);
  }

  static detail(store: StoreView, viewerId: string): DetailStoreResponseDto {
    return new DetailStoreResponseDto(store, viewerId);
  }

  private static toLocation(location: any) {
    if (Array.isArray(location?.coordinates)) {
      return {
        longitude: location.coordinates[0],
        latitude: location.coordinates[1],
      };
    }
    return {
      longitude: location.longitude,
      latitude: location.latitude,
    };
  }
}
