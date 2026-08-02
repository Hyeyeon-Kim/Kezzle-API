import { Logger } from '@nestjs/common';
import { ObjectStorageError } from '../application/object-storage.error';
import { S3ObjectStorageAdapter } from './s3-object-storage.adapter';
import { S3StorageConfig } from './s3-storage.config';

describe('S3ObjectStorageAdapter', () => {
  const config: S3StorageConfig = {
    bucket: 'contract-bucket',
    region: 'ap-northeast-2',
    accessKeyId: 'access-key',
    secretAccessKey: 'secret-key',
  };

  function createAdapter() {
    const client = {
      upload: jest.fn(),
      deleteObject: jest.fn(),
    };
    const adapter = new S3ObjectStorageAdapter(client as never, config);
    return { adapter, client };
  }

  afterEach(() => jest.restoreAllMocks());

  it('uploads the caller full key with the actual content type', async () => {
    const { adapter, client } = createAdapter();
    const promise = jest
      .fn()
      .mockResolvedValue({ Location: 'https://cdn.example.com/cake.webp' });
    client.upload.mockReturnValue({ promise });
    const body = Buffer.from('image');

    await expect(
      adapter.put({
        key: 'store-1/cakes/cake.webp',
        body,
        contentType: 'image/webp',
      }),
    ).resolves.toEqual({
      key: 'store-1/cakes/cake.webp',
      url: 'https://cdn.example.com/cake.webp',
    });
    expect(client.upload).toHaveBeenCalledWith({
      Bucket: 'contract-bucket',
      Key: 'store-1/cakes/cake.webp',
      Body: body,
      ACL: 'public-read',
      ContentType: 'image/webp',
    });
  });

  it('deletes the caller full key without parsing a URL', async () => {
    const { adapter, client } = createAdapter();
    const promise = jest.fn().mockResolvedValue(undefined);
    client.deleteObject.mockReturnValue({ promise });

    await adapter.delete('store-1/detail/image.png');

    expect(client.deleteObject).toHaveBeenCalledWith({
      Bucket: 'contract-bucket',
      Key: 'store-1/detail/image.png',
    });
  });

  it.each([
    ['put', 'store-1/cakes/image.png'],
    ['delete', 'store-1/detail/image.png'],
  ] as const)(
    'maps %s SDK failures and records structured context',
    async (operation, key) => {
      const { adapter, client } = createAdapter();
      const cause = new Error(`${operation} failed`);
      const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      if (operation === 'put') {
        client.upload.mockReturnValue({
          promise: jest.fn().mockRejectedValue(cause),
        });
      } else {
        client.deleteObject.mockReturnValue({
          promise: jest.fn().mockRejectedValue(cause),
        });
      }

      const action =
        operation === 'put'
          ? adapter.put({
              key,
              body: Buffer.from('image'),
              contentType: 'image/png',
            })
          : adapter.delete(key);

      await expect(action).rejects.toMatchObject({
        name: ObjectStorageError.name,
        operation,
        key,
        cause,
      });
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'object_storage_operation_failed',
          operation,
          key,
          bucket: config.bucket,
          region: config.region,
          error: expect.objectContaining({ message: cause.message }),
        }),
      );
    },
  );
});
