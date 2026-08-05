import { Injectable } from '@nestjs/common';
import { CakeCatalogReader } from 'src/modules/cake/application/cake-catalog.reader';
import { StoreLikePort } from 'src/modules/store/application/store-like.port';
import {
  LikedStoreCatalogReader,
  LikedStoreCatalogView,
} from '../application/liked-store-catalog.reader';

@Injectable()
export class LikedStoreCatalogAdapter implements LikedStoreCatalogReader {
  constructor(
    private readonly storeLikePort: StoreLikePort,
    private readonly cakeReader: CakeCatalogReader,
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
