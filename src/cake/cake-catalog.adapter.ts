import { Injectable } from '@nestjs/common';
import { CakeCatalogReader, CatalogCakeView } from './cake-catalog.reader';
import { CakeRepository } from './cake.repository';
import { CakeView } from './application/cake.view';

@Injectable()
export class CakeCatalogRepositoryAdapter implements CakeCatalogReader {
  constructor(private readonly cakeRepository: CakeRepository) {}

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
    return cakes.map((cake) => this.toView(cake));
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
    return cakes.map((cake) => this.toView(cake));
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
    return cakes.map((cake) => this.toView(cake));
  }

  async findRecentByStoreIds(
    storeIds: string[],
  ): Promise<Map<string, CatalogCakeView[]>> {
    const cakesByStoreId =
      await this.cakeRepository.findRecentByStoreIds(storeIds);

    return new Map(
      [...cakesByStoreId.entries()].map(([storeId, cakes]) => [
        storeId,
        cakes.map((cake) => this.toView(cake)),
      ]),
    );
  }

  private toView(cake: CakeView): CatalogCakeView {
    return {
      id: cake.id,
      image: cake.image,
      ownerStoreId: cake.ownerStoreId,
      likedUserIds: [...cake.likedUserIds],
      cursor: cake.cursor,
      tags: [...cake.tags],
    };
  }
}
