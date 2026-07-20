import { Injectable } from '@nestjs/common';
import { CatalogCakeView } from 'src/cake/cake-catalog.reader';
import {
  CatalogStoreSummaryView,
  CatalogStoreView,
} from 'src/store/store-catalog.reader';
import {
  CatalogCakeResponseDto,
  CatalogCakesResponseDto,
} from './dto/catalog-cake-response.dto';
import { CatalogSimilarCakeResponseDto } from './dto/catalog-similar-cake-response.dto';
import {
  CatalogStoreResponseDto,
  CatalogStoresResponseDto,
} from './dto/catalog-store-response.dto';
import { ImageDto } from 'src/common/image/api/image.dto';

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

  similarCake(
    cake: any,
    store: CatalogStoreSummaryView,
  ): CatalogSimilarCakeResponseDto {
    return new CatalogSimilarCakeResponseDto({
      _id: cake?.id,
      image: cake?.image,
      owner_store_id: cake?.owner_store_id,
      owner_store_name: store.name,
      owner_store_address: store.address,
      owner_store_taste: store.taste,
      owner_store_latitude: store.latitude,
      owner_store_longitude: store.longitude,
    });
  }
}
