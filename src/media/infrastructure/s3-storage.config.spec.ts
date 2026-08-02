import { loadS3StorageConfig } from './s3-storage.config';

describe('loadS3StorageConfig', () => {
  it('returns validated typed settings', () => {
    expect(
      loadS3StorageConfig({
        A_BUCKET_NAME: 'kezzle-images',
        A_REGION: 'ap-northeast-2',
        A_ACCESS_KEY_ID: 'access-key',
        A_SECRET_ACCESS_KEY: 'secret-key',
      }),
    ).toEqual({
      bucket: 'kezzle-images',
      region: 'ap-northeast-2',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
    });
  });

  it('fails during provider creation when required settings are missing', () => {
    expect(() => loadS3StorageConfig({ A_BUCKET_NAME: ' ' })).toThrow(
      'Missing required S3 configuration: A_BUCKET_NAME, A_REGION',
    );
  });

  it('rejects a partial static credential and allows the default credential chain', () => {
    expect(() =>
      loadS3StorageConfig({
        A_BUCKET_NAME: 'kezzle-images',
        A_REGION: 'ap-northeast-2',
        A_ACCESS_KEY_ID: 'access-key',
      }),
    ).toThrow(
      'A_ACCESS_KEY_ID and A_SECRET_ACCESS_KEY must be configured together',
    );

    expect(
      loadS3StorageConfig({
        A_BUCKET_NAME: 'kezzle-images',
        A_REGION: 'ap-northeast-2',
      }),
    ).toEqual({
      bucket: 'kezzle-images',
      region: 'ap-northeast-2',
      accessKeyId: undefined,
      secretAccessKey: undefined,
    });
  });
});
