import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from 'src/user/application/authenticated-user';
import { UserNotOwnerException } from 'src/user/exceptions/user-not-owner.exception';
import { Roles } from 'src/user/entities/roles.enum';
import { UploadService } from 'src/upload/upload.service';
import { CreateStoreData, UpdateStoreData } from './application/store.command';
import { StoreView } from './application/store.view';
import { StoreRepository } from './store.repository';

@Injectable()
export class StoreService {
  constructor(
    private readonly uploadService: UploadService,
    private readonly storeRepository: StoreRepository,
  ) {}

  async create(data: CreateStoreData): Promise<StoreView> {
    return this.storeRepository.create(data);
  }

  async findOne(storeId: string): Promise<StoreView> {
    return this.storeRepository.findByIdOrThrow(storeId);
  }

  async changeContent(
    storeId: string,
    updateData: UpdateStoreData,
    user: AuthenticatedUser,
  ) {
    const store = await this.storeRepository.findByIdOrThrow(storeId);
    this.assertOwnerOrAdmin(store.ownerUserId, user);
    return this.storeRepository.updateOneById(storeId, updateData);
  }

  async removeContent(storeId: string, user: AuthenticatedUser) {
    const store = await this.storeRepository.findByIdOrThrow(storeId);
    this.assertOwnerOrAdmin(store.ownerUserId, user);
    return this.storeRepository.deleteById(storeId);
  }

  async changeLogo(storeId: string, user: AuthenticatedUser, file) {
    const store = await this.storeRepository.findByIdOrThrow(storeId);
    this.assertOwnerOrAdmin(store.ownerUserId, user);
    const path = `${store.name}/logo`;
    if (store.logo !== undefined && store.logo !== null) {
      await this.uploadService.remove(path, store.logo.s3Url);
    }
    const logo = await this.uploadService.create(path, file);
    return this.storeRepository.updateOneById(storeId, { logo });
  }

  async Imageupload(storeId: string, user: AuthenticatedUser, file) {
    const store = await this.storeRepository.findByIdOrThrow(storeId);
    this.assertOwnerOrAdmin(store.ownerUserId, user);
    const path = `${store.name}/detail`;
    const image = await this.uploadService.create(path, file);
    return this.storeRepository.updateOneById(storeId, {
      detailImages: [...store.detailImages, image],
    });
  }

  async Imageremove(storeId: string, user: AuthenticatedUser, fileIdx: number) {
    const store = await this.storeRepository.findByIdOrThrow(storeId);
    this.assertOwnerOrAdmin(store.ownerUserId, user);
    const detailImages = [...store.detailImages];
    const [deletedImage] = detailImages.splice(fileIdx, 1);
    const path = `${store.name}/detail`;
    await this.uploadService.remove(path, deletedImage.s3Url);
    return this.storeRepository.updateOneById(storeId, { detailImages });
  }

  private assertOwnerOrAdmin(
    ownerUserId: string,
    user: AuthenticatedUser,
  ): void {
    if (ownerUserId !== user.firebaseUid && !user.roles.includes(Roles.ADMIN)) {
      throw new UserNotOwnerException(user.firebaseUid, ownerUserId);
    }
  }
}
