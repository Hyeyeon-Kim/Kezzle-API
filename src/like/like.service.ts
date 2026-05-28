import { Injectable } from '@nestjs/common';
import { CakeRepository } from 'src/cake/cake.repository';
import { CakeResponseDto } from 'src/cake/dto/response-cake.dto';
import { CakeAlredyLikeException } from 'src/cake/exceptions/cake-already-like.exception';
import { LogService } from 'src/log/log.service';
import { StoreLikeResponseDto } from 'src/store/dto/response-like-store.dto';
import { StoreRepository } from 'src/store/store.repository';
import { StoreAlredyLikeException } from 'src/store/exceptions/store-already-like.exception';
import { UserRepository } from 'src/user/user.repository';
import IUser from 'src/user/interfaces/user.interface';

@Injectable()
export class LikeService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly cakeRepository: CakeRepository,
    private readonly storeRepository: StoreRepository,
    private readonly logService: LogService,
  ) {}

  async findUserLikeCake(userid: string): Promise<CakeResponseDto[]> {
    const user = await this.userRepository.findByFirebaseUidOrThrow(userid);

    const cakes = await this.cakeRepository.findByIds(user.cake_like_ids);
    return cakes.map((cake) => new CakeResponseDto(cake, user.firebaseUid));
  }
  async findUserLikeStore(
    userid: string,
    Iuser: IUser,
  ): Promise<StoreLikeResponseDto[]> {
    const user = await this.userRepository.findByFirebaseUidOrThrow(userid);

    const stores = await this.storeRepository.findByUserLike(userid);
    const storeIds = stores.map((store) => store._id.toString());
    const cakesByStoreId =
      await this.cakeRepository.findRecentByStoreIds(storeIds);

    return stores.map((store) => {
      const storeId = store._id.toString();
      const cakes = (cakesByStoreId.get(storeId) ?? []).map(
        (cake) => new CakeResponseDto(cake, Iuser.firebaseUid),
      );
      return new StoreLikeResponseDto(store, user.firebaseUid, cakes);
    });
  }

  async cakeAddLikeList(cakeid: string, user: IUser): Promise<boolean> {
    const cake = await this.cakeRepository.findByIdOrThrow(cakeid);

    const userId = user.firebaseUid;
    if (!cake.user_like_ids.includes(userId)) {
      await this.cakeRepository.addUserLike(cakeid, userId);
    } else throw new CakeAlredyLikeException(cakeid);

    await this.userRepository.addCakeLike(userId, cakeid);
    this.logService.cakeLikelog(userId, cakeid, true);
    return true;
  }

  async cakeRemoveLikeList(cakeid: string, user: IUser): Promise<boolean> {
    await this.cakeRepository.findByIdOrThrow(cakeid);
    const userId = user.firebaseUid;

    await this.cakeRepository.removeUserLike(cakeid, userId);
    await this.userRepository.removeCakeLike(userId, cakeid);
    this.logService.cakeLikelog(userId, cakeid, false);
    return true;
  }

  async storeAddLikeList(storeid: string, user: IUser): Promise<boolean> {
    const store = await this.storeRepository.findByIdOrThrow(storeid);

    const userId = user.firebaseUid;
    if (!store.user_like_ids.includes(userId)) {
      await this.storeRepository.addUserLike(storeid, userId);
    } else throw new StoreAlredyLikeException(storeid);

    await this.userRepository.addStoreLike(userId, storeid);
    return true;
  }

  async storeRemoveLikeList(storeid: string, user: IUser): Promise<boolean> {
    await this.storeRepository.findByIdOrThrow(storeid);
    const userId = user.firebaseUid;

    await this.storeRepository.removeUserLike(storeid, userId);
    await this.userRepository.removeStoreLike(userId, storeid);
    return true;
  }
}
