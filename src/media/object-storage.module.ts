import { Module } from '@nestjs/common';
import { MetricsModule } from 'src/metrics/metrics.module';
import { ObjectStoragePort } from './application/object-storage.port';
import {
  S3ObjectStorageAdapter,
  s3ClientProvider,
} from './infrastructure/s3-object-storage.adapter';
import {
  S3_STORAGE_CONFIG,
  loadS3StorageConfig,
} from './infrastructure/s3-storage.config';

@Module({
  imports: [MetricsModule],
  providers: [
    { provide: S3_STORAGE_CONFIG, useFactory: loadS3StorageConfig },
    s3ClientProvider,
    S3ObjectStorageAdapter,
    { provide: ObjectStoragePort, useExisting: S3ObjectStorageAdapter },
  ],
  exports: [ObjectStoragePort],
})
export class ObjectStorageModule {}
