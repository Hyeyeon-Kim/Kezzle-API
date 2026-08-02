import { Injectable, Logger } from '@nestjs/common';
import { CakeLikePort, CakeLikeView } from 'src/cake/cake-like.port';
import { CakeAlredyLikeException } from 'src/cake/exceptions/cake-already-like.exception';
import {
  LikedStoreCatalogReader,
  LikedStoreCatalogView,
} from 'src/catalog/liked-store-catalog.reader';
import { MetricsService } from 'src/metrics/metrics.service';
import { StoreAlredyLikeException } from 'src/store/exceptions/store-already-like.exception';
import { StoreLikePort } from 'src/store/store-like.port';
import { UserLikePort } from 'src/user/user-like.port';
import { AuthenticatedUser } from 'src/user/application/authenticated-user';
import { CakeLikeEventRecorder } from './application/port/cake-like-event-recorder.port';

@Injectable()
export class LikeService {
  private readonly logger = new Logger(LikeService.name);

  constructor(
    private readonly userLikePort: UserLikePort,
    private readonly cakeLikePort: CakeLikePort,
    private readonly storeLikePort: StoreLikePort,
    private readonly likedStoreReader: LikedStoreCatalogReader,
    private readonly cakeLikeEventRecorder: CakeLikeEventRecorder,
    private readonly metricsService: MetricsService,
  ) {}

  async findUserLikeCake(userid: string): Promise<CakeLikeView[]> {
    const user = await this.userLikePort.findByFirebaseUidOrThrow(userid);

    const cakes = await this.cakeLikePort.findByIds([...user.cakeLikeIds]);
    return cakes;
  }

  async findUserLikeStore(userid: string): Promise<LikedStoreCatalogView[]> {
    await this.userLikePort.findByFirebaseUidOrThrow(userid);
    const stores = await this.likedStoreReader.findByUserLike(userid);
    return stores;
  }

  async cakeAddLikeList(
    cakeid: string,
    user: AuthenticatedUser,
  ): Promise<boolean> {
    const cake = await this.cakeLikePort.findTargetOrThrow(cakeid);

    const userId = user.firebaseUid;
    if (!cake.likedUserIds.includes(userId)) {
      await this.cakeLikePort.addUserLike(cakeid, userId);
    } else throw new CakeAlredyLikeException(cakeid);

    await this.userLikePort.addCakeLike(userId, cakeid);
    this.recordCakeLikeEvent(userId, cakeid, true);
    return true;
  }

  async cakeRemoveLikeList(
    cakeid: string,
    user: AuthenticatedUser,
  ): Promise<boolean> {
    await this.cakeLikePort.findTargetOrThrow(cakeid);
    const userId = user.firebaseUid;

    await this.cakeLikePort.removeUserLike(cakeid, userId);
    await this.userLikePort.removeCakeLike(userId, cakeid);
    this.recordCakeLikeEvent(userId, cakeid, false);
    return true;
  }

  async storeAddLikeList(
    storeid: string,
    user: AuthenticatedUser,
  ): Promise<boolean> {
    const store = await this.storeLikePort.findTargetOrThrow(storeid);

    const userId = user.firebaseUid;
    if (!store.likedUserIds.includes(userId)) {
      await this.storeLikePort.addUserLike(storeid, userId);
    } else throw new StoreAlredyLikeException(storeid);

    await this.userLikePort.addStoreLike(userId, storeid);
    return true;
  }

  async storeRemoveLikeList(
    storeid: string,
    user: AuthenticatedUser,
  ): Promise<boolean> {
    await this.storeLikePort.findTargetOrThrow(storeid);
    const userId = user.firebaseUid;

    await this.storeLikePort.removeUserLike(storeid, userId);
    await this.userLikePort.removeStoreLike(userId, storeid);
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
        this.metricsService.cakeLikeEventRecordFailures.inc();
        this.logger.error({
          event: 'cake_like_event_record_failed',
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }
}
