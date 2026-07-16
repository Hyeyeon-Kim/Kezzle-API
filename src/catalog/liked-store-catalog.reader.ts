import { CatalogCakeView } from 'src/cake/cake-catalog.reader';

export interface LikedStoreCatalogView {
  readonly id: string;
  readonly name: string;
  readonly logo: unknown;
  readonly address: string;
  readonly likedUserIds: readonly string[];
  readonly cakes: readonly CatalogCakeView[];
}

export abstract class LikedStoreCatalogReader {
  abstract findByUserLike(userId: string): Promise<LikedStoreCatalogView[]>;
}
