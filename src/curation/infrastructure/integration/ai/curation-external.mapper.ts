import { CurationCakeSnapshotView } from 'src/curation/application/curation.view';

export interface CurationCakeSnapshotSource {
  readonly id?: unknown;
  readonly _id?: unknown;
  readonly image?: Record<string, unknown> & {
    readonly name?: string;
    readonly converteName?: string;
    readonly converte_name?: string;
    readonly key?: string;
    readonly s3Url?: string;
  };
  readonly ownerStoreId?: string;
  readonly owner_store_id?: string;
  readonly cursor?: string;
  readonly tags?: string[];
  readonly tag_ins?: string[];
  readonly likedUserIds?: string[];
  readonly user_like_ids?: string[];
  readonly score?: number;
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
  'tags',
  'tag_ins',
  'likedUserIds',
  'user_like_ids',
  'score',
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
      tags: [...(record?.tags ?? record?.tag_ins ?? [])],
      likedUserIds: [...(record?.likedUserIds ?? record?.user_like_ids ?? [])],
      score: record?.score,
      extra: Object.fromEntries(
        Object.entries(record ?? {}).filter(([key]) => !KNOWN_KEYS.has(key)),
      ),
    };
  }
}
