import { CurationCakeSnapshotView } from '../curation.view';
import { ExternalImageContract } from 'src/shared/image/application/image-external.mapper';

export interface CurationCakeSnapshotSource {
  readonly id?: unknown;
  readonly _id?: unknown;
  readonly image?: ExternalImageContract;
  readonly ownerStoreId?: string;
  readonly owner_store_id?: string;
  readonly cursor?: string;
  readonly likeText?: string;
  readonly like_ins?: string;
  readonly tags?: string[];
  readonly tag_ins?: string[];
  readonly content?: string;
  readonly content_ins?: string;
  readonly calculatedLikes?: number;
  readonly cal_likes?: number;
  readonly faissId?: number;
  readonly faiss_id?: number;
  readonly isDeleted?: boolean;
  readonly is_delete?: boolean;
  readonly likedUserIds?: string[];
  readonly user_like_ids?: string[];
  readonly score?: number;
  readonly extra?: Readonly<Record<string, unknown>>;
  readonly toObject?: () => CurationCakeSnapshotSource;
}

function identifier(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

const KNOWN_KEYS = new Set([
  'id',
  '_id',
  'image',
  'ownerStoreId',
  'owner_store_id',
  'cursor',
  'likeText',
  'like_ins',
  'tags',
  'tag_ins',
  'content',
  'content_ins',
  'calculatedLikes',
  'cal_likes',
  'faissId',
  'faiss_id',
  'isDeleted',
  'is_delete',
  'likedUserIds',
  'user_like_ids',
  'score',
  'extra',
]);

export class CurationExternalMapper {
  static toSnapshot(
    source: CurationCakeSnapshotSource,
  ): CurationCakeSnapshotView {
    const record =
      typeof source?.toObject === 'function' ? source.toObject() : source;
    return {
      id: identifier(record?.id) ?? identifier(record?._id),
      image: record?.image
        ? {
            name: record.image.name,
            converteName:
              record.image.converteName ?? record.image.converte_name,
            key: record.image.key,
            s3Url: record.image.s3Url,
          }
        : undefined,
      ownerStoreId: record?.ownerStoreId ?? record?.owner_store_id,
      cursor: record?.cursor,
      likeText: record?.likeText ?? record?.like_ins,
      tags: [...(record?.tags ?? record?.tag_ins ?? [])],
      content: record?.content ?? record?.content_ins,
      calculatedLikes: record?.calculatedLikes ?? record?.cal_likes,
      faissId: record?.faissId ?? record?.faiss_id,
      isDeleted: record?.isDeleted ?? record?.is_delete,
      likedUserIds: [...(record?.likedUserIds ?? record?.user_like_ids ?? [])],
      score: record?.score,
      extra: {
        ...(record?.extra ?? {}),
        ...Object.fromEntries(
          Object.entries(record ?? {}).filter(([key]) => !KNOWN_KEYS.has(key)),
        ),
      },
    };
  }
}
