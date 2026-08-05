import { toS3StorageConfig } from './s3-storage.config';

describe('toS3StorageConfig', () => {
  it('maps only the validated typed storage config', () => {
    const config = toS3StorageConfig({
      bucket: 'kezzle-images',
      region: 'ap-northeast-2',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
    });

    expect(config).toEqual({
      bucket: 'kezzle-images',
      region: 'ap-northeast-2',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('preserves the typed default credential-chain contract', () => {
    expect(
      toS3StorageConfig({
        bucket: 'kezzle-images',
        region: 'ap-northeast-2',
      }),
    ).toEqual({
      bucket: 'kezzle-images',
      region: 'ap-northeast-2',
      accessKeyId: undefined,
      secretAccessKey: undefined,
    });
  });
});
