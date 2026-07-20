import { ImageValue } from 'src/common/image/application/image.value';

export interface CakeLikeView {
  readonly id: string;
  readonly image: ImageValue;
  readonly ownerStoreId: string;
  readonly likedUserIds: readonly string[];
  readonly cursor: string;
  readonly tags: readonly string[];
}

export interface CakeLikeTarget {
  readonly likedUserIds: readonly string[];
}

export abstract class CakeLikePort {
  abstract findByIds(cakeIds: string[]): Promise<CakeLikeView[]>;
  abstract findTargetOrThrow(cakeId: string): Promise<CakeLikeTarget>;
  abstract addUserLike(cakeId: string, userId: string): Promise<void>;
  abstract removeUserLike(cakeId: string, userId: string): Promise<void>;
}
