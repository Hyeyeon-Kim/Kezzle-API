import { UploadService } from './upload.service';

describe('UploadService', () => {
  it('returns a pure ImageValue with application camelCase fields', async () => {
    const upload = jest.fn().mockReturnValue({
      promise: jest
        .fn()
        .mockResolvedValue({ Location: 'https://cdn.example.com/cake.png' }),
    });
    const service = new UploadService();
    (service as any).s3 = { upload };

    const result = await service.create('store-1/cakes', {
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
        Key: result.key,
        Body: expect.any(Buffer),
        ContentType: 'image/png',
      }),
    );
  });
});
