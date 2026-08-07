import { CakeLikeView } from '../../../application/port/cake-like.port';
import { Cake } from '../../../application/model/cake';

export class CakeLikeMapper {
  static toView(cake: Cake): CakeLikeView {
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
