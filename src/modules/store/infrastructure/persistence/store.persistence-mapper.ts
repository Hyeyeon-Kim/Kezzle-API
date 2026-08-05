import { ImageValue } from 'src/shared/image/application/image.value';
import {
  CreateStoreData,
  UpdateStoreData,
} from '../../application/store.command';
import { StoreSummaryView, StoreView } from '../../application/store.view';

export interface StoreImagePersistenceRecord {
  readonly name: string;
  readonly converte_name: string;
  readonly key: string;
  readonly s3Url: string;
}

interface StorePersistenceSource {
  readonly _id?: unknown;
  readonly id?: unknown;
  readonly name?: string;
  readonly logo?: StoreImagePersistenceRecord | null;
  readonly store_feature?: string;
  readonly store_description?: string;
  readonly insta_url?: string;
  readonly kakako_url?: string;
  readonly kakao_map_url?: string;
  readonly location?: { readonly coordinates?: number[] };
  readonly address?: string;
  readonly phone_number?: string;
  readonly owner_user_id?: string;
  readonly detail_images?: StoreImagePersistenceRecord[];
  readonly operating_time?: string[];
  readonly user_like_ids?: string[];
  readonly taste?: string[];
  readonly dist?: number;
  readonly distance?: number;
  readonly createdAt?: Date | string;
  readonly updatedAt?: Date | string;
}

function identifier(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

function dateValue(value: Date | string | undefined): Date | undefined {
  return typeof value === 'string' ? new Date(value) : value;
}

export class StorePersistenceMapper {
  static toView(source: StorePersistenceSource): StoreView {
    const logo = source?.logo;
    return {
      id: identifier(source?._id) ?? identifier(source?.id),
      name: source?.name,
      logo: this.toImageValueOrNull(logo),
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
        this.toImageValue(image),
      ),
      operatingTime: [...(source?.operating_time ?? [])],
      likedUserIds: [...(source?.user_like_ids ?? [])],
      taste: [...(source?.taste ?? [])],
      distance: source?.dist ?? source?.distance,
      createdAt: dateValue(source?.createdAt),
      updatedAt: dateValue(source?.updatedAt),
    };
  }

  static toSummaryView(source: StorePersistenceSource): StoreSummaryView {
    return {
      id: identifier(source?._id) ?? identifier(source?.id),
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
      logo: data.logo ? this.toImagePersistence(data.logo) : undefined,
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
        this.toImagePersistence(image),
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
              this.toImagePersistence(image),
            ),
          }),
      ...(data.operatingTime === undefined
        ? {}
        : { operating_time: data.operatingTime }),
      ...(data.taste === undefined ? {} : { taste: data.taste }),
      ...(data.logo === undefined
        ? {}
        : { logo: this.toImagePersistence(data.logo) }),
    };
  }

  private static toImageValue(image: StoreImagePersistenceRecord): ImageValue {
    return {
      name: image.name,
      converteName: image.converte_name,
      key: image.key,
      s3Url: image.s3Url,
    };
  }

  private static toImageValueOrNull(
    image: StoreImagePersistenceRecord | null | undefined,
  ): ImageValue | null | undefined {
    if (image === null) return null;
    if (image === undefined) return undefined;
    return this.toImageValue(image);
  }

  private static toImagePersistence(
    image: ImageValue,
  ): StoreImagePersistenceRecord {
    return {
      name: image.name,
      converte_name: image.converteName,
      key: image.key,
      s3Url: image.s3Url,
    };
  }
}
