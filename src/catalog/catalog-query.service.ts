import { Injectable } from '@nestjs/common';
import {
  CakeCatalogReader,
  CatalogCakeView,
} from 'src/cake/cake-catalog.reader';
import { StoreCatalogReader } from 'src/store/store-catalog.reader';
import {
  CatalogCakePageView,
  CatalogStorePageView,
} from './application/catalog.view';

@Injectable()
export class CatalogQueryService {
  constructor(
    private readonly cakeReader: CakeCatalogReader,
    private readonly storeReader: StoreCatalogReader,
  ) {}

  async findAllCakes(
    latitude: number,
    longitude: number,
    distance: number,
    after: string,
    limit: number,
  ): Promise<CatalogCakePageView> {
    const storeIds = await this.storeReader.findIdsByGeoNear(
      longitude,
      latitude,
      distance,
    );
    const cakes = await this.cakeReader.findInStoresByCursor(
      storeIds,
      after,
      limit + 1,
    );
    return this.cakePage(cakes, limit);
  }

  async findAllCakesByLocation(
    latitude: number,
    longitude: number,
    distance: number,
    after: string,
    limit: number,
  ): Promise<CatalogCakePageView> {
    const storeIds = await this.storeReader.findIdsByGeoNear(
      longitude,
      latitude,
      distance,
    );
    const cakes = await this.cakeReader.findInStoresAfterId(
      storeIds,
      after,
      limit + 1,
    );
    return this.cakePage(cakes, limit);
  }

  async findStoreCakes(
    storeId: string,
    after: string,
    limit: number,
  ): Promise<CatalogCakePageView> {
    await this.storeReader.ensureExists(storeId);
    if (Number.isNaN(limit)) {
      limit = 20;
    }
    const cakes = await this.cakeReader.findByStoreIdAfter(
      storeId,
      after,
      limit + 1,
    );
    return this.cakePage(cakes, limit);
  }

  async findAllStores(
    latitude: number,
    longitude: number,
    distance: number,
    after: number,
    limit: number,
  ): Promise<CatalogStorePageView> {
    let stores = await this.storeReader.findByGeoNear(
      longitude,
      latitude,
      distance,
      after,
      limit + 1,
    );
    const hasMore = stores.length > limit;
    if (hasMore) {
      stores = stores.slice(0, stores.length - 1);
    }

    const cakesByStoreId = await this.cakeReader.findRecentByStoreIds(
      stores.map((store) => store.id),
    );
    return {
      stores,
      cakesByStoreId,
      hasMore,
    };
  }

  private cakePage(
    cakes: CatalogCakeView[],
    limit: number,
  ): CatalogCakePageView {
    const hasMore = cakes.length > limit;
    if (hasMore) {
      cakes = cakes.slice(0, cakes.length - 1);
    }
    return { cakes, hasMore };
  }
}
