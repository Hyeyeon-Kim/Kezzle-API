export interface UserLikeView {
  readonly firebaseUid: string;
  readonly cakeLikeIds: readonly string[];
  readonly storeLikeIds: readonly string[];
}

export abstract class UserLikePort {
  abstract findByFirebaseUidOrThrow(userId: string): Promise<UserLikeView>;
  abstract addCakeLike(userId: string, cakeId: string): Promise<void>;
  abstract removeCakeLike(userId: string, cakeId: string): Promise<void>;
  abstract addStoreLike(userId: string, storeId: string): Promise<void>;
  abstract removeStoreLike(userId: string, storeId: string): Promise<void>;
}
