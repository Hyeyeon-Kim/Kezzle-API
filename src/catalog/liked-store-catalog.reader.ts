import { CatalogCakeView } from 'src/cake/cake-catalog.reader';
import { ImageValue } from 'src/common/image/application/image.value';

export interface LikedStoreCatalogView {
  readonly id: string;
  readonly name: string;
  readonly logo?: ImageValue | null;
  readonly address: string;
  readonly likedUserIds: readonly string[];
  readonly cakes: readonly CatalogCakeView[];
}

export abstract class LikedStoreCatalogReader {
  abstract findByUserLike(userId: string): Promise<LikedStoreCatalogView[]>;
}
