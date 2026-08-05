import { CreateCurationData } from '../../application/curation.command';
import {
  CurationCakeSnapshotView,
  CurationView,
  StaleCurationView,
} from '../../application/curation.view';
import {
  CurationCakeSnapshotSource,
  CurationExternalMapper,
} from '../curation-external.mapper';

interface CurationPersistenceSource {
  readonly _id?: unknown;
  readonly id?: unknown;
  readonly cakes?: CurationCakeSnapshotSource[];
  readonly key?: string;
  readonly description?: string;
  readonly note?: string;
  readonly createdAt?: Date | string;
  readonly updatedAt?: Date | string;
  readonly __v?: number;
  readonly toObject?: () => CurationPersistenceSource;
}

function identifier(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

function dateValue(value: Date | string | undefined): Date | undefined {
  return typeof value === 'string' ? new Date(value) : value;
}

export class CurationPersistenceMapper {
  static toView(source: CurationPersistenceSource): CurationView {
    const record = this.toPlainObject(source);
    return {
      id: identifier(record?._id) ?? identifier(record?.id),
      cakes: (record?.cakes ?? []).map((cake) =>
        CurationExternalMapper.toSnapshot(cake),
      ),
      key: record?.key,
      description: record?.description,
      note: record?.note,
      createdAt: dateValue(record?.createdAt),
      updatedAt: dateValue(record?.updatedAt),
      version: record?.__v,
    };
  }

  static toStaleView(source: CurationPersistenceSource): StaleCurationView {
    return {
      id: identifier(source?._id) ?? identifier(source?.id),
      updatedAt: dateValue(source?.updatedAt),
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

  private static toPlainObject(
    source: CurationPersistenceSource,
  ): CurationPersistenceSource {
    return typeof source?.toObject === 'function' ? source.toObject() : source;
  }
}
