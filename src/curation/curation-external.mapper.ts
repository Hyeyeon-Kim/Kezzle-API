import { CurationCakeSnapshotView } from './application/curation.view';

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
  static toSnapshot(source: any): CurationCakeSnapshotView {
    return {
      id: source?.id?.toString() ?? source?._id?.toString(),
      image: source?.image
        ? {
            name: source.image.name,
            converteName:
              source.image.converteName ?? source.image.converte_name,
            key: source.image.key,
            s3Url: source.image.s3Url,
          }
        : undefined,
      ownerStoreId: source?.ownerStoreId ?? source?.owner_store_id,
      cursor: source?.cursor,
      tags: [...(source?.tags ?? source?.tag_ins ?? [])],
      likedUserIds: [...(source?.likedUserIds ?? source?.user_like_ids ?? [])],
      score: source?.score,
      extra: Object.fromEntries(
        Object.entries(source ?? {}).filter(([key]) => !KNOWN_KEYS.has(key)),
      ),
    };
  }
}
