import { Injectable } from '@nestjs/common';
import {
  CakeCatalogReader,
  CatalogCakeView,
} from 'src/cake/cake-catalog.reader';
import { StoreCatalogReader } from 'src/store/store-catalog.reader';
import { AuthenticatedUser } from 'src/user/application/authenticated-user';
import { CatalogPresenter } from './catalog.presenter';
import { CatalogCakesResponseDto } from './dto/catalog-cake-response.dto';
import { CatalogStoresResponseDto } from './dto/catalog-store-response.dto';

@Injectable()
export class CatalogQueryService {
  constructor(
    private readonly cakeReader: CakeCatalogReader,
    private readonly storeReader: StoreCatalogReader,
    private readonly presenter: CatalogPresenter,
  ) {}

  async findAllCakes(
    user: AuthenticatedUser,
    latitude: number,
    longitude: number,
    distance: number,
    after: string,
    limit: number,
  ): Promise<CatalogCakesResponseDto> {
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
    return this.cakePage(cakes, user.firebaseUid, limit);
  }

  async findAllCakesByLocation(
    user: AuthenticatedUser,
    latitude: number,
    longitude: number,
    distance: number,
    after: string,
    limit: number,
  ): Promise<CatalogCakesResponseDto> {
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
    return this.cakePage(cakes, user.firebaseUid, limit);
  }

  async findStoreCakes(
    storeId: string,
    user: AuthenticatedUser,
    after: string,
    limit: number,
  ): Promise<CatalogCakesResponseDto> {
    await this.storeReader.ensureExists(storeId);
    if (Number.isNaN(limit)) {
      limit = 20;
    }
    const cakes = await this.cakeReader.findByStoreIdAfter(
      storeId,
      after,
      limit + 1,
    );
    return this.cakePage(cakes, user.firebaseUid, limit);
  }

  async findAllStores(
    user: AuthenticatedUser,
    latitude: number,
    longitude: number,
    distance: number,
    after: number,
    limit: number,
  ): Promise<CatalogStoresResponseDto> {
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
    return this.presenter.stores(
      stores,
      cakesByStoreId,
      user.firebaseUid,
      hasMore,
    );
  }

  private cakePage(
    cakes: CatalogCakeView[],
    userId: string,
    limit: number,
  ): CatalogCakesResponseDto {
    const hasMore = cakes.length > limit;
    if (hasMore) {
      cakes = cakes.slice(0, cakes.length - 1);
    }
    return this.presenter.cakes(cakes, userId, hasMore);
  }
}
