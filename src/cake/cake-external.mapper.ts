import { ImageValue } from 'src/common/image/application/image.value';
import {
  ExternalImageContract,
  ImageExternalMapper,
} from 'src/common/image/image-external.mapper';
import { CakeView } from './application/cake.view';

interface CakeExternalSource {
  readonly id?: unknown;
  readonly _id?: unknown;
  readonly image?: unknown;
  readonly cursor?: string;
  readonly likedUserIds?: string[];
  readonly user_like_ids?: string[];
  readonly ownerStoreId?: string;
  readonly owner_store_id?: string;
  readonly likeText?: string;
  readonly like_ins?: string;
  readonly tags?: string[];
  readonly tag_ins?: string[];
  readonly content?: string;
  readonly content_ins?: string;
  readonly calculatedLikes?: number;
  readonly cal_likes?: number;
  readonly total?: number;
  readonly faissId?: number;
  readonly faiss_id?: number;
  readonly isDeleted?: boolean;
  readonly is_delete?: boolean;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
}

function identifier(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

export class CakeExternalMapper {
  static toView(source: CakeExternalSource): CakeView {
    return {
      id: identifier(source?.id) ?? identifier(source?._id),
      image: this.toImageValue(source?.image),
      cursor: source?.cursor,
      likedUserIds: [...(source?.likedUserIds ?? source?.user_like_ids ?? [])],
      ownerStoreId: source?.ownerStoreId ?? source?.owner_store_id,
      likeText: source?.likeText ?? source?.like_ins,
      tags: [...(source?.tags ?? source?.tag_ins ?? [])],
      content: source?.content ?? source?.content_ins,
      calculatedLikes:
        source?.calculatedLikes ?? source?.cal_likes ?? source?.total,
      faissId: source?.faissId ?? source?.faiss_id,
      isDeleted: source?.isDeleted ?? source?.is_delete ?? false,
      createdAt: source?.createdAt,
      updatedAt: source?.updatedAt,
    };
  }

  private static toImageValue(image: unknown): ImageValue {
    if (image == null || typeof image !== 'object') {
      return image as ImageValue;
    }
    return ImageExternalMapper.toValue(image as ExternalImageContract);
  }
}
