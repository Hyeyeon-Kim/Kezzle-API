import { ImageValue } from 'src/common/image/application/image.value';

export interface StoreLikeView {
  readonly id: string;
  readonly name: string;
  readonly logo?: ImageValue | null;
  readonly address: string;
  readonly likedUserIds: readonly string[];
}

export interface StoreLikeTarget {
  readonly likedUserIds: readonly string[];
}

export abstract class StoreLikePort {
  abstract findByUserLike(userId: string): Promise<StoreLikeView[]>;
  abstract findTargetOrThrow(storeId: string): Promise<StoreLikeTarget>;
  abstract addUserLike(storeId: string, userId: string): Promise<void>;
  abstract removeUserLike(storeId: string, userId: string): Promise<void>;
}
