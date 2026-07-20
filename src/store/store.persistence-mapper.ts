import { ImageMapper } from 'src/common/image/image.mapper';
import { CreateStoreData, UpdateStoreData } from './application/store.command';
import { StoreSummaryView, StoreView } from './application/store.view';

export class StorePersistenceMapper {
  static toView(source: any): StoreView {
    return {
      id: source?._id?.toString() ?? source?.id?.toString(),
      name: source?.name,
      logo:
        source?.logo == null ? source?.logo : ImageMapper.toValue(source.logo),
      feature: source?.store_feature ?? '',
      description: source?.store_description ?? '',
      instagramUrl: source?.insta_url ?? '',
      kakaoChannelUrl: source?.kakako_url ?? '',
      kakaoMapUrl: source?.kakao_map_url ?? '',
      location: source?.location
        ? {
            longitude: source.location.coordinates?.[0],
            latitude: source.location.coordinates?.[1],
          }
        : undefined,
      address: source?.address,
      phoneNumber: source?.phone_number ?? '',
      ownerUserId: source?.owner_user_id,
      detailImages: (source?.detail_images ?? []).map((image) =>
        ImageMapper.toValue(image),
      ),
      operatingTime: [...(source?.operating_time ?? [])],
      likedUserIds: [...(source?.user_like_ids ?? [])],
      taste: [...(source?.taste ?? [])],
      distance: source?.dist ?? source?.distance,
      createdAt: source?.createdAt,
      updatedAt: source?.updatedAt,
    };
  }

  static toSummaryView(source: any): StoreSummaryView {
    return {
      id: source?._id?.toString() ?? source?.id?.toString(),
      name: source?.name,
      address: source?.address,
      taste: [...(source?.taste ?? [])],
      longitude: source?.location?.coordinates?.[0],
      latitude: source?.location?.coordinates?.[1],
    };
  }

  static toCreatePersistence(data: CreateStoreData) {
    return {
      name: data.name,
      logo: data.logo ? ImageMapper.toPersistence(data.logo) : undefined,
      store_feature: data.feature,
      store_description: data.description,
      insta_url: data.instagramUrl,
      kakako_url: data.kakaoChannelUrl,
      location: {
        type: 'Point',
        coordinates: [data.location.longitude, data.location.latitude],
      },
      address: data.address,
      phone_number: data.phoneNumber,
      owner_user_id: data.ownerUserId,
      detail_images: data.detailImages?.map((image) =>
        ImageMapper.toPersistence(image),
      ),
      operating_time: data.operatingTime,
      taste: data.taste,
    };
  }

  static toUpdatePersistence(data: UpdateStoreData) {
    return {
      ...(data.feature === undefined ? {} : { store_feature: data.feature }),
      ...(data.description === undefined
        ? {}
        : { store_description: data.description }),
      ...(data.instagramUrl === undefined
        ? {}
        : { insta_url: data.instagramUrl }),
      ...(data.kakaoChannelUrl === undefined
        ? {}
        : { kakako_url: data.kakaoChannelUrl }),
      ...(data.location === undefined
        ? {}
        : {
            location: {
              type: 'Point',
              coordinates: [data.location.longitude, data.location.latitude],
            },
          }),
      ...(data.address === undefined ? {} : { address: data.address }),
      ...(data.phoneNumber === undefined
        ? {}
        : { phone_number: data.phoneNumber }),
      ...(data.detailImages === undefined
        ? {}
        : {
            detail_images: data.detailImages.map((image) =>
              ImageMapper.toPersistence(image),
            ),
          }),
      ...(data.operatingTime === undefined
        ? {}
        : { operating_time: data.operatingTime }),
      ...(data.taste === undefined ? {} : { taste: data.taste }),
      ...(data.logo === undefined
        ? {}
        : { logo: ImageMapper.toPersistence(data.logo) }),
    };
  }
}
