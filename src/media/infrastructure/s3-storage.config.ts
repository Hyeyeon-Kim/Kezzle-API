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

export function loadS3StorageConfig(
  environment: NodeJS.ProcessEnv = process.env,
): S3StorageConfig {
  const missing = Object.keys(requiredSettings).filter(
    (name) => !environment[name]?.trim(),
  );

  if (missing.length > 0) {
    throw new Error(`Missing required S3 configuration: ${missing.join(', ')}`);
  }

  const accessKeyId = environment.A_ACCESS_KEY_ID?.trim();
  const secretAccessKey = environment.A_SECRET_ACCESS_KEY?.trim();
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error(
      'A_ACCESS_KEY_ID and A_SECRET_ACCESS_KEY must be configured together',
    );
  }

  return Object.freeze({
    bucket: environment.A_BUCKET_NAME,
    region: environment.A_REGION,
    accessKeyId,
    secretAccessKey,
  });
}
