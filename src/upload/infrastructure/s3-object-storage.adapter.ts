import { Inject, Injectable, Logger, Provider } from '@nestjs/common';
import { S3 } from 'aws-sdk';
import { ObjectStorageError } from '../application/object-storage.error';
import {
  ObjectStoragePort,
  PutObjectRequest,
  StoredObject,
} from '../application/object-storage.port';
import { S3_STORAGE_CONFIG, S3StorageConfig } from './s3-storage.config';

interface S3Client {
  upload(params: {
    Bucket: string;
    Key: string;
    Body: Buffer;
    ACL: 'public-read';
    ContentType: string;
  }): { promise(): Promise<{ Location?: string }> };
  deleteObject(params: { Bucket: string; Key: string }): {
    promise(): Promise<unknown>;
  };
}

export const S3_CLIENT = Symbol('S3_CLIENT');

export const s3ClientProvider: Provider = {
  provide: S3_CLIENT,
  inject: [S3_STORAGE_CONFIG],
  useFactory: (config: S3StorageConfig): S3Client =>
    new S3({
      region: config.region,
      ...(config.accessKeyId === undefined
        ? {}
        : {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }),
    }),
};

@Injectable()
export class S3ObjectStorageAdapter implements ObjectStoragePort {
  private readonly logger = new Logger(S3ObjectStorageAdapter.name);

  constructor(
    @Inject(S3_CLIENT) private readonly client: S3Client,
    @Inject(S3_STORAGE_CONFIG) private readonly config: S3StorageConfig,
  ) {}

  async put(request: PutObjectRequest): Promise<StoredObject> {
    try {
      const result = await this.client
        .upload({
          Bucket: this.config.bucket,
          Key: request.key,
          Body: request.body,
          ACL: 'public-read',
          ContentType: request.contentType,
        })
        .promise();

      if (result.Location === undefined) {
        throw new Error('S3 upload response did not contain Location');
      }

      return { key: request.key, url: result.Location };
    } catch (error) {
      this.logFailure('put', request.key, error);
      throw new ObjectStorageError('put', request.key, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client
        .deleteObject({
          Bucket: this.config.bucket,
          Key: key,
        })
        .promise();
    } catch (error) {
      this.logFailure('delete', key, error);
      throw new ObjectStorageError('delete', key, error);
    }
  }

  private logFailure(
    operation: 'put' | 'delete',
    key: string,
    error: unknown,
  ): void {
    this.logger.error({
      event: 'object_storage_operation_failed',
      operation,
      key,
      bucket: this.config.bucket,
      region: this.config.region,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : { value: String(error) },
    });
  }
}
