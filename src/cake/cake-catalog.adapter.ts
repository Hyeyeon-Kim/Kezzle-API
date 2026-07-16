import { Injectable } from '@nestjs/common';
import { CakeCatalogReader, CatalogCakeView } from './cake-catalog.reader';
import { CakeRepository } from './cake.repository';

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

  private toView(cake: any): CatalogCakeView {
    return {
      id: cake?._id?.toString() ?? cake?.id?.toString(),
      image: cake?.image,
      ownerStoreId: cake?.owner_store_id,
      likedUserIds: [...(cake?.user_like_ids ?? [])],
      cursor: cake?.cursor,
      tags: [...(cake?.tag_ins ?? [])],
    };
  }
}
