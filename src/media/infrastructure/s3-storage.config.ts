export interface S3StorageConfig {
  readonly bucket: string;
  readonly region: string;
  readonly accessKeyId?: string;
  readonly secretAccessKey?: string;
}

export const S3_STORAGE_CONFIG = Symbol('S3_STORAGE_CONFIG');

const requiredSettings = {
  A_BUCKET_NAME: 'bucket',
  A_REGION: 'region',
} as const;

export function loadS3StorageConfig(environment: {
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  A_BUCKET_NAME?: string;
  A_REGION?: string;
  A_ACCESS_KEY_ID?: string;
  A_SECRET_ACCESS_KEY?: string;
}): S3StorageConfig {
  const normalized = {
    bucket: environment.bucket ?? environment.A_BUCKET_NAME,
    region: environment.region ?? environment.A_REGION,
    accessKeyId: environment.accessKeyId ?? environment.A_ACCESS_KEY_ID,
    secretAccessKey:
      environment.secretAccessKey ?? environment.A_SECRET_ACCESS_KEY,
  };
  const missing = Object.keys(requiredSettings).filter(
    (name) => !normalized[requiredSettings[name]]?.trim(),
  );

  if (missing.length > 0) {
    throw new Error(`Missing required S3 configuration: ${missing.join(', ')}`);
  }

  const accessKeyId = normalized.accessKeyId?.trim();
  const secretAccessKey = normalized.secretAccessKey?.trim();
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error(
      'A_ACCESS_KEY_ID and A_SECRET_ACCESS_KEY must be configured together',
    );
  }

  return Object.freeze({
    bucket: normalized.bucket,
    region: normalized.region,
    accessKeyId,
    secretAccessKey,
  });
}
