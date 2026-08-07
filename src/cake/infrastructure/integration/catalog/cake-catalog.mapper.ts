import { CatalogCakeView } from '../../../application/port/cake-catalog.port';
import { Cake } from '../../../domain/cake';

export class CakeCatalogMapper {
  static toView(cake: Cake): CatalogCakeView {
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
