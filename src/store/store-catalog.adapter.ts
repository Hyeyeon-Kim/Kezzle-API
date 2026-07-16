import { Injectable } from '@nestjs/common';
import {
  CatalogStoreSummaryView,
  CatalogStoreView,
  StoreCatalogReader,
} from './store-catalog.reader';
import { StoreRepository } from './store.repository';
import { StoresNotFoundException } from './exceptions/stores-not-found.exception';

const CATALOG_SUMMARY_PROJECTION = {
  name: 1 as const,
  address: 1 as const,
  taste: 1 as const,
  location: 1 as const,
};

@Injectable()
export class StoreCatalogRepositoryAdapter implements StoreCatalogReader {
  constructor(private readonly storeRepository: StoreRepository) {}

  findIdsByGeoNear(
    longitude: number,
    latitude: number,
    distance?: number,
  ): Promise<string[]> {
    return this.storeRepository.findIdsByGeoNear(longitude, latitude, distance);
  }

  async findByGeoNear(
    longitude: number,
    latitude: number,
    distance: number,
    after: number,
    limit: number,
  ): Promise<CatalogStoreView[]> {
    const stores = await this.storeRepository
      .findByGeoNear(longitude, latitude, distance, after, limit)
      .catch(() => {
        throw new StoresNotFoundException();
      });
    return stores.map((store) => ({
      id: store?._id?.toString() ?? store?.id?.toString(),
      name: store?.name,
      logo: store?.logo,
      address: store?.address,
      likedUserIds: [...(store?.user_like_ids ?? [])],
      distance: store?.dist,
    }));
  }

  async ensureExists(storeId: string): Promise<void> {
    await this.storeRepository.findByIdOrThrow(storeId);
  }

  async findSummariesByIds(
    storeIds: string[],
  ): Promise<CatalogStoreSummaryView[]> {
    const stores = await this.storeRepository.findByIdsWithProjection(
      storeIds,
      CATALOG_SUMMARY_PROJECTION,
    );
    return stores.map((store: any) => ({
      id: store?._id?.toString() ?? store?.id?.toString(),
      name: store?.name,
      address: store?.address,
      taste: [...(store?.taste ?? [])],
      longitude: store?.location?.coordinates?.[0],
      latitude: store?.location?.coordinates?.[1],
    }));
  }
}
