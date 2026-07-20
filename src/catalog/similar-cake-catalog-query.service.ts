import { Injectable } from '@nestjs/common';
import { VitClient } from 'src/ai-search/vit-client';
import { MetricsService } from 'src/metrics/metrics.service';
import { StoreCatalogReader } from 'src/store/store-catalog.reader';
import { CatalogSimilarCakePageView } from './application/catalog.view';

@Injectable()
export class SimilarCakeCatalogQueryService {
  constructor(
    private readonly storeReader: StoreCatalogReader,
    private readonly vitClient: VitClient,
    private readonly metricsService: MetricsService,
  ) {}

  async execute(
    cakeId: string,
    longitude: number,
    latitude: number,
    distance: number,
    size: number,
  ): Promise<CatalogSimilarCakePageView> {
    const endSimilarSearch =
      this.metricsService.similarSearchDuration.startTimer();

    try {
      const cakes = await this.vitClient.similarSearchWithLocation(
        cakeId,
        longitude,
        latitude,
        distance,
        size,
      );
      const storeIds = [
        ...new Set(cakes.map((cake) => cake.owner_store_id).filter(Boolean)),
      ] as string[];
      const endStoreQuery = this.metricsService.storeQueryDuration.startTimer();
      const stores = await this.storeReader.findSummariesByIds(storeIds);
      endStoreQuery();

      const storeMap = new Map(stores.map((store) => [store.id, store]));
      const response = cakes
        .map((cake) => {
          const store = storeMap.get(cake.owner_store_id);
          return store
            ? {
                id: cake.id,
                image: cake.image,
                ownerStoreId: cake.owner_store_id,
                ownerStoreName: store.name,
                ownerStoreAddress: store.address,
                ownerStoreTaste: store.taste,
                ownerStoreLatitude: store.latitude,
                ownerStoreLongitude: store.longitude,
              }
            : null;
        })
        .filter((cake) => cake !== null);

      endSimilarSearch({ status: 'success' });
      return { cakes: response, hasMore: false };
    } catch (error) {
      endSimilarSearch({ status: 'error' });
      throw error;
    }
  }
}
