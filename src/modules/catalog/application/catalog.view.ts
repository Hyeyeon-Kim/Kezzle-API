import { CatalogCakeView } from 'src/modules/cake/application/cake-catalog.reader';
import { CatalogStoreView } from 'src/modules/store/application/store-catalog.reader';

export interface CatalogCakePageView {
  readonly cakes: CatalogCakeView[];
  readonly hasMore: boolean;
}

export interface CatalogStorePageView {
  readonly stores: CatalogStoreView[];
  readonly cakesByStoreId: Map<string, CatalogCakeView[]>;
  readonly hasMore: boolean;
}

export interface CatalogSimilarCakeView {
  readonly id: string;
  readonly image: unknown;
  readonly ownerStoreId: string;
  readonly ownerStoreName: string;
  readonly ownerStoreAddress: string;
  readonly ownerStoreTaste: readonly string[];
  readonly ownerStoreLatitude: number;
  readonly ownerStoreLongitude: number;
}

export interface CatalogSimilarCakePageView {
  readonly cakes: CatalogSimilarCakeView[];
  readonly hasMore: boolean;
}
