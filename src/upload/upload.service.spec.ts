import { UploadService } from './upload.service';
import baseline from '../../test/fixtures/log-upload-baseline.contract.json';
import { S3DeleteException } from './exception/s3-delete.exception';
import { S3UploadException } from './exception/s3-upload.exception';

describe('UploadService', () => {
  beforeEach(() => {
    process.env.A_BUCKET_NAME = 'contract-bucket';
  });

  afterEach(() => {
    delete process.env.A_BUCKET_NAME;
    jest.restoreAllMocks();
  });

  it('returns a pure ImageValue with application camelCase fields', async () => {
    const upload = jest.fn().mockReturnValue({
      promise: jest
        .fn()
        .mockResolvedValue({ Location: 'https://cdn.example.com/cake.png' }),
    });
    const service = new UploadService();
    (service as any).s3 = { upload };

    const result = await service.create(baseline.mediaPaths.cakeCreate, {
      originalname: 'cake.png',
      buffer: Buffer.from('image'),
    });

    expect(result).toEqual({
      name: 'cake.png',
      converteName: expect.stringMatching(/^[0-9a-f-]+\.png$/),
      key: expect.stringMatching(/^store-1\/cakes\/[0-9a-f-]+\.png$/),
      s3Url: 'https://cdn.example.com/cake.png',
    });
    expect(result).not.toHaveProperty('converte_name');
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'contract-bucket',
        Key: result.key,
        Body: expect.any(Buffer),
        ACL: 'public-read',
        ContentType: 'image/png',
      }),
    );
  });

  it('deletes the URL file name from the current parent object path', async () => {
    const promise = jest.fn().mockResolvedValue(undefined);
    const deleteObject = jest.fn().mockReturnValue({ promise });
    const service = new UploadService();
    (service as any).s3 = { deleteObject };

    await service.remove(
      baseline.mediaPaths.storeLogo,
      'https://cdn.example.com/legacy-logo.png',
    );

    expect(deleteObject).toHaveBeenCalledWith({
      Bucket: 'contract-bucket',
      Key: `${baseline.mediaPaths.storeLogo}/legacy-logo.png`,
    });
    expect(promise).toHaveBeenCalledTimes(1);
  });

  it('maps S3 upload failure to S3UploadException', async () => {
    jest.spyOn(console, 'log').mockImplementation();
    const service = new UploadService();
    (service as any).s3 = {
      upload: jest.fn().mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('upload failed')),
      }),
    };

    await expect(
      service.create(baseline.mediaPaths.cakeCreate, {
        originalname: 'cake.png',
        buffer: Buffer.from('image'),
      }),
    ).rejects.toBeInstanceOf(S3UploadException);
  });

  it('maps S3 delete failure to S3DeleteException', async () => {
    jest.spyOn(console, 'error').mockImplementation();
    const service = new UploadService();
    (service as any).s3 = {
      deleteObject: jest.fn().mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('delete failed')),
      }),
    };

    await expect(
      service.remove(
        baseline.mediaPaths.storeDetail,
        'https://cdn.example.com/detail.png',
      ),
    ).rejects.toBeInstanceOf(S3DeleteException);
  });
});
