import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ImageValue } from 'src/common/image/application/image.value';
import { AuthenticatedUser } from 'src/user/application/authenticated-user';
import { Roles } from 'src/user/entities/roles.enum';
import { UserNotOwnerException } from 'src/user/exceptions/user-not-owner.exception';
import { MediaFile } from 'src/media/application/media-file';
import { ObjectStorageError } from 'src/media/application/object-storage.error';
import { ObjectStoragePort } from 'src/media/application/object-storage.port';
import { S3UploadException } from 'src/media/exception/s3-upload.exception';
import { MetricsService } from 'src/metrics/metrics.service';
import { StoreRepository } from './store.repository';

@Injectable()
export class StoreMediaService {
  private readonly logger = new Logger(StoreMediaService.name);

  constructor(
    private readonly objectStorage: ObjectStoragePort,
    private readonly storeRepository: StoreRepository,
    private readonly metricsService: MetricsService,
  ) {}

  async replaceLogo(storeId: string, user: AuthenticatedUser, file: MediaFile) {
    const store = await this.storeRepository.findByIdOrThrow(storeId);
    this.assertOwnerOrAdmin(store.ownerUserId, user);
    const logo = await this.upload(`${store.id}/logo`, file);

    let result;
    try {
      result = await this.storeRepository.updateOneById(storeId, { logo });
    } catch (error) {
      await this.compensateNewObject(logo.key, storeId, 'replace_logo', error);
      throw error;
    }

    if (store.logo !== undefined && store.logo !== null) {
      await this.deleteCommittedObject(
        store.logo.key,
        storeId,
        'replace_previous_logo',
      );
    }
    return result;
  }

  async addDetailImage(
    storeId: string,
    user: AuthenticatedUser,
    file: MediaFile,
  ) {
    const store = await this.storeRepository.findByIdOrThrow(storeId);
    this.assertOwnerOrAdmin(store.ownerUserId, user);
    const image = await this.upload(`${store.id}/detail`, file);

    try {
      return await this.storeRepository.updateOneById(storeId, {
        detailImages: [...store.detailImages, image],
      });
    } catch (error) {
      await this.compensateNewObject(
        image.key,
        storeId,
        'add_detail_image',
        error,
      );
      throw error;
    }
  }

  async removeDetailImage(
    storeId: string,
    user: AuthenticatedUser,
    fileIndex: number,
  ) {
    const store = await this.storeRepository.findByIdOrThrow(storeId);
    this.assertOwnerOrAdmin(store.ownerUserId, user);
    const detailImages = [...store.detailImages];
    const [removedImage] = detailImages.splice(fileIndex, 1);
    if (removedImage === undefined) {
      throw new TypeError(`Store detail image index is invalid: ${fileIndex}`);
    }

    const result = await this.storeRepository.updateOneById(storeId, {
      detailImages,
    });
    await this.deleteCommittedObject(
      removedImage.key,
      storeId,
      'remove_detail_image',
    );
    return result;
  }

  private async upload(prefix: string, file: MediaFile): Promise<ImageValue> {
    const extension = file.originalName.split('.').pop();
    const convertedName = `${randomUUID()}.${extension}`;
    const key = `${prefix}/${convertedName}`;

    try {
      const stored = await this.objectStorage.put({
        key,
        body: file.buffer,
        contentType: file.contentType,
      });
      return {
        name: file.originalName,
        converteName: convertedName,
        key: stored.key,
        s3Url: stored.url,
      };
    } catch (error) {
      if (error instanceof ObjectStorageError) {
        throw new S3UploadException();
      }
      throw error;
    }
  }

  private async compensateNewObject(
    key: string,
    storeId: string,
    operation: string,
    cause: unknown,
  ): Promise<void> {
    try {
      await this.objectStorage.delete(key);
    } catch (error) {
      this.recordOrphan(
        key,
        storeId,
        `${operation}_compensation`,
        error,
        cause,
      );
    }
  }

  private async deleteCommittedObject(
    key: string,
    storeId: string,
    operation: string,
  ): Promise<void> {
    try {
      await this.objectStorage.delete(key);
    } catch (error) {
      this.recordOrphan(key, storeId, operation, error);
    }
  }

  private recordOrphan(
    key: string,
    storeId: string,
    operation: string,
    error: unknown,
    cause?: unknown,
  ): void {
    this.metricsService.mediaObjectOrphans.inc({
      feature: 'store',
      operation,
    });
    this.logger.error({
      event: 'store_media_object_orphaned',
      storeId,
      key,
      operation,
      error: this.errorDetails(error),
      cause: cause === undefined ? undefined : this.errorDetails(cause),
    });
  }

  private errorDetails(error: unknown) {
    return error instanceof Error
      ? { name: error.name, message: error.message }
      : { value: String(error) };
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
