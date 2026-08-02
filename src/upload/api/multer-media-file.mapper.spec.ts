import { MulterMediaFileMapper } from './multer-media-file.mapper';

describe('MulterMediaFileMapper', () => {
  it('maps the API upload shape to a pure MediaFile explicitly', () => {
    const buffer = Buffer.from('image');

    expect(
      MulterMediaFileMapper.toMediaFile({
        originalname: 'cake.jpeg',
        mimetype: 'image/jpeg',
        buffer,
      }),
    ).toEqual({
      originalName: 'cake.jpeg',
      contentType: 'image/jpeg',
      buffer,
    });
  });

  it('maps absent single and list fields without leaking Multer keys', () => {
    expect(MulterMediaFileMapper.toMediaFile(undefined)).toBeUndefined();
    expect(MulterMediaFileMapper.toMediaFiles(undefined)).toEqual([]);
  });
});
