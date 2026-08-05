import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ImageValue } from 'src/common/image/application/image.value';
import { StoreCakeWriteContextReader } from 'src/store/store-cake-write-context.reader';
import { AuthenticatedUser } from 'src/user/application/authenticated-user';
import { Roles } from 'src/user/entities/roles.enum';
import { UserNotOwnerException } from 'src/user/exceptions/user-not-owner.exception';
import { MediaFile } from 'src/media/application/media-file';
import { validateImageMediaFile } from 'src/media/application/media-file-signature.validator';
import { ObjectStorageError } from 'src/media/application/object-storage.error';
import { ObjectStoragePort } from 'src/media/application/object-storage.port';
import { S3UploadException } from 'src/media/exception/s3-upload.exception';
import { MediaMetricsAdapter } from 'src/media/media-metrics.adapter';
import { CakeRepository } from './cake.repository';

@Injectable()
export class CakeMediaService {
  private readonly logger = new Logger(CakeMediaService.name);

  constructor(
    private readonly objectStorage: ObjectStoragePort,
    private readonly storeWriteContext: StoreCakeWriteContextReader,
    private readonly cakeRepository: CakeRepository,
    private readonly metrics: MediaMetricsAdapter,
  ) {}

  async replaceImage(cakeId: string, user: AuthenticatedUser, file: MediaFile) {
    const cake = await this.cakeRepository.findByIdOrThrow(cakeId);
    const store = await this.storeWriteContext.findByIdOrThrow(
      cake.ownerStoreId,
    );
    this.assertOwnerOrAdmin(store.ownerUserId, user);
    const image = await this.uploadCakeImage(store.storeId, file);

    let result;
    try {
      result = await this.cakeRepository.updateOneById(cakeId, { image });
    } catch (error) {
      await this.compensateNewObject(
        image.key,
        store.storeId,
        'replace_image',
        error,
      );
      throw error;
    }

    await this.deleteCommittedObject(
      cake.image.key,
      store.storeId,
      'replace_previous_image',
    );
    return result;
  }

  async softDelete(cakeId: string, user: AuthenticatedUser) {
    const cake = await this.cakeRepository.findByIdOrThrow(cakeId);
    const store = await this.storeWriteContext.findByIdOrThrow(
      cake.ownerStoreId,
    );
    this.assertOwnerOrAdmin(store.ownerUserId, user);

    const result = await this.cakeRepository.updateOneById(cakeId, {
      isDeleted: true,
    });
    await this.deleteCommittedObject(
      cake.image.key,
      store.storeId,
      'soft_delete',
    );
    return result;
  }

  async uploadImportImage(
    storeId: string,
    file: MediaFile,
  ): Promise<ImageValue> {
    return this.uploadCakeImage(storeId, file);
  }

  async compensateImportImage(
    storeId: string,
    image: ImageValue,
    cause: unknown,
  ): Promise<void> {
    await this.compensateNewObject(
      image.key,
      storeId,
      'bulk_import_row',
      cause,
    );
  }

  private async uploadCakeImage(
    storeId: string,
    file: MediaFile,
  ): Promise<ImageValue> {
    const validatedFile = validateImageMediaFile(file);
    const extension = validatedFile.originalName.split('.').pop();
    const convertedName = `${randomUUID()}.${extension}`;
    const key = `${storeId}/cakes/${convertedName}`;

    try {
      const stored = await this.objectStorage.put({
        key,
        body: validatedFile.buffer,
        contentType: validatedFile.contentType,
      });
      return {
        name: validatedFile.originalName,
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
    this.metrics.countOrphan('cake', operation);
    this.logger.error({
      event: 'cake_media_object_orphaned',
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
