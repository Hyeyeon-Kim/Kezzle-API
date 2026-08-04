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
import { ConfigModule, ConfigType } from '@nestjs/config';
import storageConfig from 'src/config/storage.config';

@Module({
  imports: [ConfigModule.forFeature(storageConfig), MediaObservabilityModule],
  providers: [
    {
      provide: S3_STORAGE_CONFIG,
      inject: [storageConfig.KEY],
      useFactory: (config: ConfigType<typeof storageConfig>) =>
        loadS3StorageConfig(config),
    },
    s3ClientProvider,
    S3ObjectStorageAdapter,
    { provide: ObjectStoragePort, useExisting: S3ObjectStorageAdapter },
  ],
  exports: [ObjectStoragePort],
})
export class ObjectStorageModule {}
