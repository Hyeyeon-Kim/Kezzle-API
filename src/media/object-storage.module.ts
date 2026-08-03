import { Module } from '@nestjs/common';
import { ObjectStoragePort } from './application/object-storage.port';
import {
  S3ObjectStorageAdapter,
  s3ClientProvider,
} from './infrastructure/s3-object-storage.adapter';
import {
  S3_STORAGE_CONFIG,
  loadS3StorageConfig,
} from './infrastructure/s3-storage.config';
import { MediaObservabilityModule } from './media-observability.module';

@Module({
  imports: [MediaObservabilityModule],
  providers: [
    { provide: S3_STORAGE_CONFIG, useFactory: loadS3StorageConfig },
    s3ClientProvider,
    S3ObjectStorageAdapter,
    { provide: ObjectStoragePort, useExisting: S3ObjectStorageAdapter },
  ],
  exports: [ObjectStoragePort],
})
export class ObjectStorageModule {}
