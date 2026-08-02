import { ImageValue } from 'src/common/image/application/image.value';
import { CreateCakeData, UpdateCakeData } from './application/cake.command';
import { CakeView } from './application/cake.view';

export interface CakeImagePersistenceRecord {
  readonly name: string;
  readonly converte_name: string;
  readonly key: string;
  readonly s3Url: string;
}

interface CakePersistenceSource {
  readonly _id?: unknown;
  readonly id?: unknown;
  readonly image?: CakeImagePersistenceRecord;
  readonly cursor?: string;
  readonly user_like_ids?: string[];
  readonly owner_store_id?: string;
  readonly like_ins?: string;
  readonly tag_ins?: string[];
  readonly content_ins?: string;
  readonly cal_likes?: number;
  readonly faiss_id?: number;
  readonly is_delete?: boolean;
  readonly createdAt?: Date | string;
  readonly updatedAt?: Date | string;
}

function identifier(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

function dateValue(value: Date | string | undefined): Date | undefined {
  return typeof value === 'string' ? new Date(value) : value;
}

export class CakePersistenceMapper {
  static toView(source: CakePersistenceSource): CakeView {
    return {
      id: identifier(source?._id) ?? identifier(source?.id),
      image: source?.image ? this.toImageValue(source.image) : undefined,
      cursor: source?.cursor,
      likedUserIds: [...(source?.user_like_ids ?? [])],
      ownerStoreId: source?.owner_store_id,
      likeText: source?.like_ins,
      tags: [...(source?.tag_ins ?? [])],
      content: source?.content_ins,
      calculatedLikes: source?.cal_likes,
      faissId: source?.faiss_id,
      isDeleted: source?.is_delete ?? false,
      createdAt: dateValue(source?.createdAt),
      updatedAt: dateValue(source?.updatedAt),
    };
  }

  static toCreatePersistence(data: CreateCakeData) {
    return {
      image: this.toImagePersistence(data.image),
      owner_store_id: data.ownerStoreId,
      cursor: data.cursor,
      like_ins: data.likeText,
      tag_ins: data.tags,
      content_ins: data.content,
      faiss_id: data.faissId,
    };
  }

  static toUpdatePersistence(data: UpdateCakeData) {
    return {
      ...(data.image === undefined
        ? {}
        : { image: this.toImagePersistence(data.image) }),
      ...(data.isDeleted === undefined ? {} : { is_delete: data.isDeleted }),
    };
  }

  private static toImageValue(image: CakeImagePersistenceRecord): ImageValue {
    return {
      name: image.name,
      converteName: image.converte_name,
      key: image.key,
      s3Url: image.s3Url,
    };
  }

  private static toImagePersistence(
    image: ImageValue,
  ): CakeImagePersistenceRecord {
    return {
      name: image.name,
      converte_name: image.converteName,
      key: image.key,
      s3Url: image.s3Url,
    };
  }
}
