import baseline from '../../test/fixtures/log-upload-baseline.contract.json';
import { ObjectStorageError } from './application/object-storage.error';
import { ObjectStoragePort } from './application/object-storage.port';
import { S3DeleteException } from './exception/s3-delete.exception';
import { S3UploadException } from './exception/s3-upload.exception';
import { UploadService } from './upload.service';

describe('UploadService compatibility facade', () => {
  function createService() {
    const objectStorage = {
      put: jest.fn(),
      delete: jest.fn(),
    } satisfies jest.Mocked<ObjectStoragePort>;

    return {
      service: new UploadService(objectStorage),
      objectStorage,
    };
  }

  it('preserves the legacy key and ImageValue while passing the actual MIME type', async () => {
    const { service, objectStorage } = createService();
    objectStorage.put.mockImplementation(async (request) => ({
      key: request.key,
      url: 'https://cdn.example.com/cake.png',
    }));

    const result = await service.create(baseline.mediaPaths.cakeCreate, {
      originalName: 'cake.png',
      contentType: 'image/custom-png',
      buffer: Buffer.from('image'),
    });

    expect(result).toEqual({
      name: 'cake.png',
      converteName: expect.stringMatching(/^[0-9a-f-]+\.png$/),
      key: expect.stringMatching(/^store-1\/cakes\/[0-9a-f-]+\.png$/),
      s3Url: 'https://cdn.example.com/cake.png',
    });
    expect(result).not.toHaveProperty('converte_name');
    expect(objectStorage.put).toHaveBeenCalledWith({
      key: result.key,
      body: expect.any(Buffer),
      contentType: 'image/custom-png',
    });
  });

  it('keeps URL parsing only in the compatibility facade and passes a full key to the port', async () => {
    const { service, objectStorage } = createService();
    objectStorage.delete.mockResolvedValue(undefined);

    await service.remove(
      baseline.mediaPaths.storeLogo,
      'https://cdn.example.com/legacy-logo.png',
    );

    expect(objectStorage.delete).toHaveBeenCalledWith(
      `${baseline.mediaPaths.storeLogo}/legacy-logo.png`,
    );
  });

  it('maps object storage put failure to the existing S3UploadException', async () => {
    const { service, objectStorage } = createService();
    objectStorage.put.mockRejectedValue(
      new ObjectStorageError('put', 'store-1/cakes/cake.png', new Error()),
    );

    await expect(
      service.create(baseline.mediaPaths.cakeCreate, {
        originalName: 'cake.png',
        contentType: 'image/png',
        buffer: Buffer.from('image'),
      }),
    ).rejects.toBeInstanceOf(S3UploadException);
  });

  it('maps object storage delete failure to the existing S3DeleteException', async () => {
    const { service, objectStorage } = createService();
    objectStorage.delete.mockRejectedValue(
      new ObjectStorageError('delete', 'store-1/detail/image.png', new Error()),
    );

    await expect(
      service.remove(
        baseline.mediaPaths.storeDetail,
        'https://cdn.example.com/detail.png',
      ),
    ).rejects.toBeInstanceOf(S3DeleteException);
  });
});
