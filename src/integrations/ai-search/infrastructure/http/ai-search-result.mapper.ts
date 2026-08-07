import { AiSearchCakeResult } from '../../application/ai-search-result';
import {
  ExternalImageContract,
  ImageExternalMapper,
} from 'src/shared/image/application/image-external.mapper';

export interface ExternalAiSearchCakeResult {
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
  readonly score?: number;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
  readonly [key: string]: unknown;
}

export interface ExternalAiSearchCakePageResult {
  readonly result: ExternalAiSearchCakeResult[];
  readonly nextPage?: number;
  readonly isLastPage?: boolean;
}

const KNOWN_KEYS = new Set([
  'id',
  '_id',
  'image',
  'cursor',
  'likedUserIds',
  'user_like_ids',
  'ownerStoreId',
  'owner_store_id',
  'likeText',
  'like_ins',
  'tags',
  'tag_ins',
  'content',
  'content_ins',
  'calculatedLikes',
  'cal_likes',
  'total',
  'faissId',
  'faiss_id',
  'isDeleted',
  'is_delete',
  'score',
  'createdAt',
  'updatedAt',
]);

function identifier(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

export class AiSearchResultMapper {
  static toApplication(source: ExternalAiSearchCakeResult): AiSearchCakeResult {
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
      score: source?.score,
      createdAt: source?.createdAt,
      updatedAt: source?.updatedAt,
      extra: Object.fromEntries(
        Object.entries(source ?? {}).filter(([key]) => !KNOWN_KEYS.has(key)),
      ),
    };
  }

  private static toImageValue(image: unknown) {
    if (image == null || typeof image !== 'object') {
      return image as never;
    }
    return ImageExternalMapper.toValue(image as ExternalImageContract);
  }
}
