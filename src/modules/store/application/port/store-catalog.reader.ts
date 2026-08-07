import { ImageValue } from 'src/shared/image/application/image.value';

export interface CatalogStoreView {
  readonly id: string;
  readonly name: string;
  readonly logo?: ImageValue | null;
  readonly address: string;
  readonly likedUserIds: readonly string[];
  readonly distance: number;
}

export interface CatalogStoreSummaryView {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly taste: readonly string[];
  readonly longitude: number;
  readonly latitude: number;
}

export abstract class StoreCatalogReader {
  abstract findIdsByGeoNear(
    longitude: number,
    latitude: number,
    distance?: number,
  ): Promise<string[]>;

  abstract findByGeoNear(
    longitude: number,
    latitude: number,
    distance: number,
    after: number,
    limit: number,
  ): Promise<CatalogStoreView[]>;

  abstract ensureExists(storeId: string): Promise<void>;

  abstract findSummariesByIds(
    storeIds: string[],
  ): Promise<CatalogStoreSummaryView[]>;
}
