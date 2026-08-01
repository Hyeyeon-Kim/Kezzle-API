import { Injectable } from '@nestjs/common';
import { CatalogCakeView } from 'src/cake/cake-catalog.reader';
import { CatalogStoreView } from 'src/store/store-catalog.reader';
import {
  CatalogCakeResponseDto,
  CatalogCakesResponseDto,
} from './dto/catalog-cake-response.dto';
import {
  CatalogSimilarCakeResponseDto,
  CatalogSimilarCakesResponseDto,
} from './dto/catalog-similar-cake-response.dto';
import {
  CatalogStoreResponseDto,
  CatalogStoresResponseDto,
} from './dto/catalog-store-response.dto';
import { ImageDto } from 'src/common/image/api/image.dto';
import {
  CatalogCakePageView,
  CatalogSimilarCakePageView,
  CatalogSimilarCakeView,
  CatalogStorePageView,
} from '../application/catalog.view';

@Injectable()
export class CatalogPresenter {
  cake(cake: CatalogCakeView, userId: string): CatalogCakeResponseDto {
    return new CatalogCakeResponseDto({
      _id: cake.id,
      image: new ImageDto(cake.image),
      owner_store_id: cake.ownerStoreId,
      isLiked: cake.likedUserIds.includes(userId),
      cursor: cake.cursor,
      hashtag: cake.tags,
    });
  }

  cakes(
    cakes: CatalogCakeView[],
    userId: string,
    hasMore: boolean,
  ): CatalogCakesResponseDto {
    return new CatalogCakesResponseDto(
      cakes.map((cake) => this.cake(cake, userId)),
      hasMore,
    );
  }

  cakePage(page: CatalogCakePageView, userId: string): CatalogCakesResponseDto {
    return this.cakes(page.cakes, userId, page.hasMore);
  }

  stores(
    stores: CatalogStoreView[],
    cakesByStoreId: Map<string, CatalogCakeView[]>,
    userId: string,
    hasMore: boolean,
  ): CatalogStoresResponseDto {
    return new CatalogStoresResponseDto(
      stores.map(
        (store) =>
          new CatalogStoreResponseDto({
            _id: store.id,
            name: store.name,
            logo: store.logo == null ? store.logo : new ImageDto(store.logo),
            address: store.address,
            isLiked: store.likedUserIds.includes(userId),
            distance: store.distance,
            cakes: (cakesByStoreId.get(store.id) ?? []).map((cake) =>
              this.cake(cake, userId),
            ),
          }),
      ),
      hasMore,
    );
  }

  storePage(
    page: CatalogStorePageView,
    userId: string,
  ): CatalogStoresResponseDto {
    return this.stores(page.stores, page.cakesByStoreId, userId, page.hasMore);
  }

  similarCake(cake: CatalogSimilarCakeView): CatalogSimilarCakeResponseDto {
    return new CatalogSimilarCakeResponseDto({
      _id: cake.id,
      image: cake.image,
      owner_store_id: cake.ownerStoreId,
      owner_store_name: cake.ownerStoreName,
      owner_store_address: cake.ownerStoreAddress,
      owner_store_taste: cake.ownerStoreTaste,
      owner_store_latitude: cake.ownerStoreLatitude,
      owner_store_longitude: cake.ownerStoreLongitude,
    });
  }

  similarCakes(
    page: CatalogSimilarCakePageView,
  ): CatalogSimilarCakesResponseDto {
    return new CatalogSimilarCakesResponseDto(
      page.cakes.map((cake) => this.similarCake(cake)),
      page.hasMore,
    );
  }
}
