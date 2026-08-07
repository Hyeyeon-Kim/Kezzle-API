import { Injectable } from '@nestjs/common';
import { CakeLikeView } from 'src/cake/application/port/cake-like.port';
import { LikedStoreCatalogView } from 'src/catalog/application/port/liked-store-catalog.reader';
import { LikedCakeResponseDto } from 'src/like/api/dto/response/liked-cake-response.dto';
import { LikedStoreResponseDto } from 'src/like/api/dto/response/liked-store-response.dto';
import { ImageDto } from 'src/common/image/api/image.dto';

@Injectable()
export class LikePresenter {
  cake(cake: CakeLikeView, viewerUserId: string): LikedCakeResponseDto {
    return new LikedCakeResponseDto({
      _id: cake.id,
      image: new ImageDto(cake.image),
      owner_store_id: cake.ownerStoreId,
      isLiked: cake.likedUserIds.includes(viewerUserId),
      cursor: cake.cursor,
      hashtag: cake.tags,
    });
  }

  cakes(cakes: CakeLikeView[], viewerUserId: string): LikedCakeResponseDto[] {
    return cakes.map((cake) => this.cake(cake, viewerUserId));
  }

  stores(
    stores: LikedStoreCatalogView[],
    targetUserId: string,
    viewerUserId: string,
  ): LikedStoreResponseDto[] {
    return stores.map(
      (store) =>
        new LikedStoreResponseDto({
          _id: store.id,
          name: store.name,
          logo: store.logo == null ? store.logo : new ImageDto(store.logo),
          address: store.address,
          isLiked: store.likedUserIds.includes(targetUserId),
          cakes: store.cakes.map((cake) => this.cake(cake, viewerUserId)),
        }),
    );
  }
}
