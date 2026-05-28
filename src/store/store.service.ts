import { Injectable } from '@nestjs/common';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { Store } from './entities/store.schema';
import { DetailStoreResponseDto } from './dto/response-detail-store.dto';
import { StoreResponseDto } from './dto/response-store.dto';
import IUser from 'src/user/interfaces/user.interface';
import { StoresNotFoundException } from './exceptions/stores-not-found.exception';
import { UserNotOwnerException } from 'src/user/exceptions/user-not-owner.exception';
import { Roles } from 'src/user/entities/roles.enum';
import { UploadService } from 'src/upload/upload.service';
import { UpdateStoreLogoDto } from './dto/update-store-logo.dto';
import { S3 } from 'aws-sdk';
import { StoresResponseDto } from './dto/response-stores.dto';
import { UpdateStoreImageDto } from './dto/update-store-image.dto';
import { CakeRepository } from 'src/cake/cake.repository';
import { CakeResponseDto } from 'src/cake/dto/response-cake.dto';
import { StoreRepository } from './store.repository';

@Injectable()
export class StoreService {
  private s3 = new S3();
  constructor(
    private readonly cakeRepository: CakeRepository,
    private readonly uploadService: UploadService,
    private readonly storeRepository: StoreRepository,
  ) {}

  async findAll(
    user: IUser,
    latitude: number,
    longitude: number,
    distance: number,
    after: number,
    limit: number,
  ) {
    let stores = await this.storeRepository
      .findByGeoNear(longitude, latitude, distance, after, limit + 1)
      .catch(() => {
        throw new StoresNotFoundException();
      });
    let hasMore = false;

    if (stores.length > limit) {
      hasMore = true;
      stores = stores.slice(0, stores.length - 1);
    }

    const storeIds = stores.map((store) => store._id.toString());
    const cakesByStoreId =
      await this.cakeRepository.findRecentByStoreIds(storeIds);

    const storeResponse = stores.map((store) => {
      const storeIdStr = store._id.toString();
      const cakeDocs = cakesByStoreId.get(storeIdStr) ?? [];
      const cakes = cakeDocs.map(
        (cake) => new CakeResponseDto(cake, user.firebaseUid),
      );
      return new StoreResponseDto(store, user.firebaseUid, cakes);
    });

    return new StoresResponseDto(storeResponse, hasMore);
  }

  async create(createStoreDto: CreateStoreDto): Promise<Store> {
    return this.storeRepository.create(createStoreDto);
  }

  async findOne(storeid: string, user: IUser): Promise<DetailStoreResponseDto> {
    const store = await this.storeRepository.findByIdOrThrow(storeid);
    return new DetailStoreResponseDto(store, user.firebaseUid);
  }

  async changeContent(
    storeid: string,
    updateData: UpdateStoreDto,
    user: IUser,
  ) {
    const store = await this.storeRepository.findByIdOrThrow(storeid);

    if (
      store.owner_user_id !== user.firebaseUid &&
      !user.roles.includes(Roles.ADMIN)
    ) {
      throw new UserNotOwnerException(user.firebaseUid, store.owner_user_id);
    }
    return await this.storeRepository.updateOneById(storeid, updateData);
  }

  async removeContent(storeid: string, user: IUser) {
    const store = await this.storeRepository.findByIdOrThrow(storeid);
    if (
      store.owner_user_id !== user.firebaseUid &&
      !user.roles.includes(Roles.ADMIN)
    ) {
      throw new UserNotOwnerException(user.firebaseUid, store.owner_user_id);
    }
    return await this.storeRepository.deleteById(storeid);
  }

  async changeLogo(storeid: string, user: IUser, file) {
    const store = await this.storeRepository.findByIdOrThrow(storeid);

    if (
      store.owner_user_id !== user.firebaseUid &&
      !user.roles.includes(Roles.ADMIN)
    ) {
      throw new UserNotOwnerException(user.firebaseUid, store.owner_user_id);
    }

    const path = store.name + '/logo';

    if (store.logo !== undefined) {
      await this.uploadService.remove(path, store.logo.s3Url);
    }
    const updatedata = new UpdateStoreLogoDto(
      await this.uploadService.create(path, file),
    );

    return await this.storeRepository.updateOneById(storeid, updatedata);
  }

  async Imageupload(storeid: string, user: IUser, file) {
    const store = await this.storeRepository.findByIdOrThrow(storeid);

    if (
      store.owner_user_id !== user.firebaseUid &&
      !user.roles.includes(Roles.ADMIN)
    ) {
      throw new UserNotOwnerException(user.firebaseUid, store.owner_user_id);
    }

    const path = store.name + '/detail';

    const updatedata = new UpdateStoreImageDto(
      await this.uploadService.create(path, file),
      store.detail_images,
    );

    return await this.storeRepository.updateOneById(storeid, updatedata);
  }

  async Imageremove(storeid: string, user: IUser, fileIdx: number) {
    const store = await this.storeRepository.findByIdOrThrow(storeid);

    if (
      store.owner_user_id !== user.firebaseUid &&
      !user.roles.includes(Roles.ADMIN)
    ) {
      throw new UserNotOwnerException(user.firebaseUid, store.owner_user_id);
    }

    const path = store.name + '/detail';

    const deleteData = store.detail_images.splice(fileIdx, 1);
    await this.uploadService.remove(path, deleteData[0].s3Url);

    return await this.storeRepository.updateOneById(storeid, store);
  }
}
