import { MulterMediaFileMapper } from './multer-media-file.mapper';

describe('MulterMediaFileMapper', () => {
  it.each([
    ['cake.jpeg', 'image/jpeg'],
    ['cake.png', 'image/png'],
    ['cake.webp', 'image/webp'],
    [
      'cakes.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  ])('maps %s to a pure MediaFile explicitly', (originalname, mimetype) => {
    const buffer = Buffer.from('untrusted-api-bytes');

    expect(
      MulterMediaFileMapper.toMediaFile({
        originalname,
        mimetype,
        buffer,
      }),
    ).toEqual({
      originalName: originalname,
      contentType: mimetype,
      buffer,
    });
  });

  it('maps absent single and list fields without leaking Multer keys', () => {
    expect(MulterMediaFileMapper.toMediaFile(undefined)).toBeUndefined();
    expect(MulterMediaFileMapper.toMediaFiles(undefined)).toEqual([]);
  });
});
