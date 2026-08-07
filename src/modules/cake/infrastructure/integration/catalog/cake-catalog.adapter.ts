import { Injectable } from '@nestjs/common';
import {
  CakeCatalogPort,
  CatalogCakeView,
} from '../../../application/port/cake-catalog.port';
import { CakeRepositoryPort } from '../../../application/port/cake-repository.port';
import { CakeCatalogMapper } from './cake-catalog.mapper';

@Injectable()
export class CakeCatalogAdapter implements CakeCatalogPort {
  constructor(private readonly cakeRepository: CakeRepositoryPort) {}

  async findInStoresByCursor(
    storeIds: string[],
    after: string,
    limit: number,
  ): Promise<CatalogCakeView[]> {
    const cakes = await this.cakeRepository.findInStoresByCursor(
      storeIds,
      after,
      limit,
    );
    return cakes.map(CakeCatalogMapper.toView);
  }

  async findInStoresAfterId(
    storeIds: string[],
    after: string,
    limit: number,
  ): Promise<CatalogCakeView[]> {
    const cakes = await this.cakeRepository.findInStoresAfterId(
      storeIds,
      after,
      limit,
    );
    return cakes.map(CakeCatalogMapper.toView);
  }

  async findByStoreIdAfter(
    storeId: string,
    after: string,
    limit: number,
  ): Promise<CatalogCakeView[]> {
    const cakes = await this.cakeRepository.findByStoreIdAfter(
      storeId,
      after,
      limit,
    );
    return cakes.map(CakeCatalogMapper.toView);
  }

  async findRecentByStoreIds(
    storeIds: string[],
  ): Promise<Map<string, CatalogCakeView[]>> {
    const cakesByStoreId =
      await this.cakeRepository.findRecentByStoreIds(storeIds);

    return new Map(
      [...cakesByStoreId.entries()].map(([storeId, cakes]) => [
        storeId,
        cakes.map(CakeCatalogMapper.toView),
      ]),
    );
  }
}
