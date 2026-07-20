import { Injectable } from '@nestjs/common';
import { CakeLikePort } from 'src/cake/cake-like.port';
import { CakeAlredyLikeException } from 'src/cake/exceptions/cake-already-like.exception';
import { LikedStoreCatalogReader } from 'src/catalog/liked-store-catalog.reader';
import { LogService } from 'src/log/log.service';
import { StoreAlredyLikeException } from 'src/store/exceptions/store-already-like.exception';
import { StoreLikePort } from 'src/store/store-like.port';
import { UserLikePort } from 'src/user/user-like.port';
import { AuthenticatedUser } from 'src/user/application/authenticated-user';
import { LikedCakeResponseDto } from './dto/liked-cake-response.dto';
import { LikedStoreResponseDto } from './dto/liked-store-response.dto';
import { LikePresenter } from './like.presenter';

@Injectable()
export class LikeService {
  constructor(
    private readonly userLikePort: UserLikePort,
    private readonly cakeLikePort: CakeLikePort,
    private readonly storeLikePort: StoreLikePort,
    private readonly likedStoreReader: LikedStoreCatalogReader,
    private readonly logService: LogService,
    private readonly presenter: LikePresenter,
  ) {}

  async findUserLikeCake(userid: string): Promise<LikedCakeResponseDto[]> {
    const user = await this.userLikePort.findByFirebaseUidOrThrow(userid);

    const cakes = await this.cakeLikePort.findByIds([...user.cakeLikeIds]);
    return cakes.map((cake) => this.presenter.cake(cake, user.firebaseUid));
  }
  async findUserLikeStore(
    userid: string,
    viewer: AuthenticatedUser,
  ): Promise<LikedStoreResponseDto[]> {
    const user = await this.userLikePort.findByFirebaseUidOrThrow(userid);
    const stores = await this.likedStoreReader.findByUserLike(userid);
    return this.presenter.stores(stores, user.firebaseUid, viewer.firebaseUid);
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
    this.logService.cakeLikelog(userId, cakeid, true);
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
    this.logService.cakeLikelog(userId, cakeid, false);
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
}
