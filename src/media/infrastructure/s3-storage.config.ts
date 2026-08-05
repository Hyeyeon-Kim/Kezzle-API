import type { StorageConfig } from 'src/config/storage.config';

export type S3StorageConfig = StorageConfig;

export const S3_STORAGE_CONFIG = Symbol('S3_STORAGE_CONFIG');

export function toS3StorageConfig(config: StorageConfig): S3StorageConfig {
  return Object.freeze({
    bucket: config.bucket,
    region: config.region,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });
}
