import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from 'src/user/application/authenticated-user';
import { UserNotOwnerException } from 'src/user/exceptions/user-not-owner.exception';
import { Roles } from 'src/user/entities/roles.enum';
import { UploadService } from 'src/upload/upload.service';
import { ImageMapper } from 'src/common/image/image.mapper';
import { CreateStoreData, UpdateStoreData } from './application/store.command';
import { CreateStoreDto } from './dto/create-store.dto';
import { CreateStoreResponseDto } from './dto/response-create-store.dto';
import { DetailStoreResponseDto } from './dto/response-detail-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { StoreRepository } from './store.repository';

@Injectable()
export class StoreService {
  constructor(
    private readonly uploadService: UploadService,
    private readonly storeRepository: StoreRepository,
  ) {}

  async create(
    createStoreDto: CreateStoreDto,
  ): Promise<CreateStoreResponseDto> {
    const store = await this.storeRepository.create(
      this.toCreateData(createStoreDto),
    );
    return new CreateStoreResponseDto(store);
  }

  async findOne(
    storeId: string,
    user: AuthenticatedUser,
  ): Promise<DetailStoreResponseDto> {
    const store = await this.storeRepository.findByIdOrThrow(storeId);
    return new DetailStoreResponseDto(store, user.firebaseUid);
  }

  async changeContent(
    storeId: string,
    updateData: UpdateStoreDto,
    user: AuthenticatedUser,
  ) {
    const store = await this.storeRepository.findByIdOrThrow(storeId);
    this.assertOwnerOrAdmin(store.ownerUserId, user);
    return this.storeRepository.updateOneById(
      storeId,
      this.toUpdateData(updateData),
    );
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

  private toCreateData(dto: CreateStoreDto): CreateStoreData {
    return {
      name: dto.name,
      logo: dto.logo ? ImageMapper.toValue(dto.logo) : undefined,
      feature: dto.store_feature,
      description: dto.store_description,
      instagramUrl: dto.insta_url,
      kakaoChannelUrl: dto.kakako_url,
      location: this.toLocation(dto.location),
      address: dto.address,
      phoneNumber: dto.phone_number,
      ownerUserId: dto.owner_user_id,
      detailImages: dto.detailImages?.map((image) =>
        ImageMapper.toValue(image),
      ),
      operatingTime: dto.operating_time,
      taste: dto.taste,
    };
  }

  private toUpdateData(dto: UpdateStoreDto): UpdateStoreData {
    return {
      feature: dto.store_feature,
      description: dto.store_description,
      instagramUrl: dto.insta_url,
      kakaoChannelUrl: dto.kakako_url,
      location: dto.location ? this.toLocation(dto.location) : undefined,
      address: dto.address,
      phoneNumber: dto.phone_number,
      detailImages: dto.detail_images?.map((image) =>
        ImageMapper.toValue(image),
      ),
      operatingTime: dto.operating_time,
      taste: dto.taste,
    };
  }

  private toLocation(location: any) {
    if (Array.isArray(location?.coordinates)) {
      return {
        longitude: location.coordinates[0],
        latitude: location.coordinates[1],
      };
    }
    return {
      longitude: location.longitude,
      latitude: location.latitude,
    };
  }
}
