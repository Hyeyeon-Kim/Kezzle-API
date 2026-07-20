import { CreateCurationData } from './application/curation.command';
import {
  CurationCakeSnapshotView,
  CurationView,
  StaleCurationView,
} from './application/curation.view';
import { CurationExternalMapper } from './curation-external.mapper';

export class CurationPersistenceMapper {
  static toView(source: any): CurationView {
    return {
      id: source?._id?.toString() ?? source?.id?.toString(),
      cakes: (source?.cakes ?? []).map((cake) =>
        CurationExternalMapper.toSnapshot(cake),
      ),
      key: source?.key,
      description: source?.description,
      note: source?.note,
      createdAt: source?.createdAt,
      updatedAt: source?.updatedAt,
      version: source?.__v,
    };
  }

  static toStaleView(source: any): StaleCurationView {
    return {
      id: source?._id?.toString() ?? source?.id?.toString(),
      updatedAt: source?.updatedAt,
    };
  }

  static toCreatePersistence(data: CreateCurationData) {
    return {
      cakes: data.cakes.map((cake) => this.toCakePersistence(cake)),
      key: data.key,
      description: data.description,
      note: data.note,
    };
  }

  static toCakePersistence(cake: CurationCakeSnapshotView) {
    return {
      ...cake.extra,
      id: cake.id,
      image: cake.image
        ? {
            name: cake.image.name,
            converte_name: cake.image.converteName,
            key: cake.image.key,
            s3Url: cake.image.s3Url,
          }
        : undefined,
      owner_store_id: cake.ownerStoreId,
      cursor: cake.cursor,
      tag_ins: cake.tags,
      user_like_ids: cake.likedUserIds,
      score: cake.score,
    };
  }
}
