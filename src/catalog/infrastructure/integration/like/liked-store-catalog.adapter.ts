import { Injectable } from '@nestjs/common';
import { CakeCatalogPort } from 'src/cake/application/port/cake-catalog.port';
import { StoreLikePort } from 'src/store/application/port/store-like.port';
import {
  LikedStoreCatalogReader,
  LikedStoreCatalogView,
} from 'src/catalog/application/port/liked-store-catalog.reader';

@Injectable()
export class LikedStoreCatalogAdapter implements LikedStoreCatalogReader {
  constructor(
    private readonly storeLikePort: StoreLikePort,
    private readonly cakeReader: CakeCatalogPort,
  ) {}

  async findByUserLike(userId: string): Promise<LikedStoreCatalogView[]> {
    const stores = await this.storeLikePort.findByUserLike(userId);
    const cakesByStoreId = await this.cakeReader.findRecentByStoreIds(
      stores.map((store) => store.id),
    );

    return stores.map((store) => ({
      ...store,
      cakes: cakesByStoreId.get(store.id) ?? [],
    }));
  }
}
