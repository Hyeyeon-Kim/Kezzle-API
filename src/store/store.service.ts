import { Injectable } from '@nestjs/common';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { Store } from './entities/store.schema';
import { DetailStoreResponseDto } from './dto/response-detail-store.dto';
import IUser from 'src/user/interfaces/user.interface';
import { UserNotOwnerException } from 'src/user/exceptions/user-not-owner.exception';
import { Roles } from 'src/user/entities/roles.enum';
import { UploadService } from 'src/upload/upload.service';
import { UpdateStoreLogoDto } from './dto/update-store-logo.dto';
import { S3 } from 'aws-sdk';
import { UpdateStoreImageDto } from './dto/update-store-image.dto';
import { StoreRepository } from './store.repository';

@Injectable()
export class StoreService {
  private s3 = new S3();
  constructor(
    private readonly uploadService: UploadService,
    private readonly storeRepository: StoreRepository,
  ) {}

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
