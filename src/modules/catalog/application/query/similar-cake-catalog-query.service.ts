import { Injectable } from '@nestjs/common';
import { VitSearchPort } from 'src/integrations/ai-search/application/vit-search.port';
import { StoreCatalogReader } from 'src/modules/store/application/port/store-catalog.reader';
import { CatalogSimilarCakePageView } from 'src/modules/catalog/application/query/catalog.view';
import { CatalogMetrics } from 'src/modules/catalog/application/port/catalog-metrics.port';

@Injectable()
export class SimilarCakeCatalogQueryService {
  constructor(
    private readonly storeReader: StoreCatalogReader,
    private readonly vitClient: VitSearchPort,
    private readonly metrics: CatalogMetrics,
  ) {}

  async execute(
    cakeId: string,
    longitude: number,
    latitude: number,
    distance: number,
    size: number,
  ): Promise<CatalogSimilarCakePageView> {
    const endSimilarSearch = this.metrics.startSimilarSearch();

    try {
      const cakes = await this.vitClient.similarSearchWithLocation(
        cakeId,
        longitude,
        latitude,
        distance,
        size,
      );
      const storeIds = [
        ...new Set(cakes.map((cake) => cake.ownerStoreId).filter(Boolean)),
      ] as string[];
      const endStoreQuery = this.metrics.startStoreQuery();
      const stores = await this.storeReader.findSummariesByIds(storeIds);
      endStoreQuery();

      const storeMap = new Map(stores.map((store) => [store.id, store]));
      const response = cakes
        .map((cake) => {
          const store = storeMap.get(cake.ownerStoreId);
          return store
            ? {
                id: cake.id,
                image: cake.image,
                ownerStoreId: cake.ownerStoreId,
                ownerStoreName: store.name,
                ownerStoreAddress: store.address,
                ownerStoreTaste: store.taste,
                ownerStoreLatitude: store.latitude,
                ownerStoreLongitude: store.longitude,
              }
            : null;
        })
        .filter((cake) => cake !== null);

      endSimilarSearch('success');
      return { cakes: response, hasMore: false };
    } catch (error) {
      endSimilarSearch('error');
      throw error;
    }
  }
}
