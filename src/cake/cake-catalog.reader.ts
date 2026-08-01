import { ImageValue } from 'src/common/image/application/image.value';

export interface CatalogCakeView {
  readonly id: string;
  readonly image: ImageValue;
  readonly ownerStoreId: string;
  readonly likedUserIds: readonly string[];
  readonly cursor: string;
  readonly tags: readonly string[];
}

export abstract class CakeCatalogReader {
  abstract findInStoresByCursor(
    storeIds: string[],
    after: string,
    limit: number,
  ): Promise<CatalogCakeView[]>;

  abstract findInStoresAfterId(
    storeIds: string[],
    after: string,
    limit: number,
  ): Promise<CatalogCakeView[]>;

  abstract findByStoreIdAfter(
    storeId: string,
    after: string,
    limit: number,
  ): Promise<CatalogCakeView[]>;

  abstract findRecentByStoreIds(
    storeIds: string[],
  ): Promise<Map<string, CatalogCakeView[]>>;
}
