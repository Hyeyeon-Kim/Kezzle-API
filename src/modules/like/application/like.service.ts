import { Injectable, Logger } from '@nestjs/common';
import {
  CakeLikePort,
  CakeLikeView,
} from 'src/modules/cake/application/port/cake-like.port';
import { CakeAlreadyLikedException } from 'src/modules/like/application/exception/cake-already-liked.exception';
import {
  LikedStoreCatalogReader,
  LikedStoreCatalogView,
} from 'src/modules/catalog/application/port/liked-store-catalog.reader';
import { StoreAlreadyLikedException } from 'src/modules/like/application/exception/store-already-liked.exception';
import { StoreLikePort } from 'src/modules/store/application/port/store-like.port';
import { UserLikePort } from 'src/modules/user/application/port/user-like.port';
import { AuthenticatedUser } from 'src/platform/auth/authenticated-user';
import { CakeLikeEventRecorder } from 'src/modules/like/application/port/cake-like-event-recorder.port';
import { CakeLikeEventMetrics } from 'src/modules/like/application/port/cake-like-event-metrics.port';

@Injectable()
export class LikeService {
  private readonly logger = new Logger(LikeService.name);

  constructor(
    private readonly userLikePort: UserLikePort,
    private readonly cakeLikePort: CakeLikePort,
    private readonly storeLikePort: StoreLikePort,
    private readonly likedStoreReader: LikedStoreCatalogReader,
    private readonly cakeLikeEventRecorder: CakeLikeEventRecorder,
    private readonly metrics: CakeLikeEventMetrics,
  ) {}

  async findUserLikeCake(userId: string): Promise<CakeLikeView[]> {
    const user = await this.userLikePort.findByFirebaseUidOrThrow(userId);

    const cakes = await this.cakeLikePort.findByIds([...user.cakeLikeIds]);
    return cakes;
  }

  async findUserLikeStore(userId: string): Promise<LikedStoreCatalogView[]> {
    await this.userLikePort.findByFirebaseUidOrThrow(userId);
    const stores = await this.likedStoreReader.findByUserLike(userId);
    return stores;
  }

  async cakeAddLikeList(
    cakeId: string,
    user: AuthenticatedUser,
  ): Promise<boolean> {
    const cake = await this.cakeLikePort.findTargetOrThrow(cakeId);

    const userId = user.firebaseUid;
    if (!cake.likedUserIds.includes(userId)) {
      await this.cakeLikePort.addUserLike(cakeId, userId);
    } else throw new CakeAlreadyLikedException(cakeId);

    await this.userLikePort.addCakeLike(userId, cakeId);
    this.recordCakeLikeEvent(userId, cakeId, true);
    return true;
  }

  async cakeRemoveLikeList(
    cakeId: string,
    user: AuthenticatedUser,
  ): Promise<boolean> {
    await this.cakeLikePort.findTargetOrThrow(cakeId);
    const userId = user.firebaseUid;

    await this.cakeLikePort.removeUserLike(cakeId, userId);
    await this.userLikePort.removeCakeLike(userId, cakeId);
    this.recordCakeLikeEvent(userId, cakeId, false);
    return true;
  }

  async storeAddLikeList(
    storeId: string,
    user: AuthenticatedUser,
  ): Promise<boolean> {
    const store = await this.storeLikePort.findTargetOrThrow(storeId);

    const userId = user.firebaseUid;
    if (!store.likedUserIds.includes(userId)) {
      await this.storeLikePort.addUserLike(storeId, userId);
    } else throw new StoreAlreadyLikedException(storeId);

    await this.userLikePort.addStoreLike(userId, storeId);
    return true;
  }

  async storeRemoveLikeList(
    storeId: string,
    user: AuthenticatedUser,
  ): Promise<boolean> {
    await this.storeLikePort.findTargetOrThrow(storeId);
    const userId = user.firebaseUid;

    await this.storeLikePort.removeUserLike(storeId, userId);
    await this.userLikePort.removeStoreLike(userId, storeId);
    return true;
  }

  private recordCakeLikeEvent(
    userId: string,
    cakeId: string,
    type: boolean,
  ): void {
    void this.cakeLikeEventRecorder
      .record(userId, cakeId, type)
      .catch((error: unknown) => {
        this.metrics.countRecordFailure();
        this.logger.error({
          event: 'cake_like_event_record_failed',
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }
}
