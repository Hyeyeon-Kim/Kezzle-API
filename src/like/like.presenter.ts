import { Injectable } from '@nestjs/common';
import { CakeLikeView } from 'src/cake/cake-like.port';
import { LikedStoreCatalogView } from 'src/catalog/liked-store-catalog.reader';
import { LikedCakeResponseDto } from './dto/liked-cake-response.dto';
import { LikedStoreResponseDto } from './dto/liked-store-response.dto';

@Injectable()
export class LikePresenter {
  cake(cake: CakeLikeView, viewerUserId: string): LikedCakeResponseDto {
    return new LikedCakeResponseDto({
      _id: cake.id,
      image: cake.image,
      owner_store_id: cake.ownerStoreId,
      isLiked: cake.likedUserIds.includes(viewerUserId),
      cursor: cake.cursor,
      hashtag: cake.tags,
    });
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
          logo: store.logo,
          address: store.address,
          isLiked: store.likedUserIds.includes(targetUserId),
          cakes: store.cakes.map((cake) => this.cake(cake, viewerUserId)),
        }),
    );
  }
}
