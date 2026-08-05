import { UnsupportedMediaFileException } from 'src/media/exception/unsupported-media-file.exception';
import * as XLSX from 'xlsx';
import {
  MEDIA_FILE_SIGNATURE_MISMATCH_MESSAGE,
  validateImageMediaFile,
  validateXlsxMediaFile,
} from './media-file-signature.validator';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const webp = Buffer.from('RIFF0000WEBPVP8 ', 'ascii');

function createXlsx(): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([['img'], ['cake.jpg']]),
    'cakes',
  );
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

describe('Media file signature validator', () => {
  it.each([
    ['JPEG', 'cake.jpg', 'image/jpeg', jpeg],
    ['PNG', 'cake.png', 'image/png', png],
    ['WebP', 'cake.webp', 'image/webp', webp],
  ])(
    'accepts a matching %s and returns its signature-confirmed content type',
    (_name, originalName, contentType, buffer) => {
      const input = { originalName, contentType, buffer };

      const validated = validateImageMediaFile(input);

      expect(validated).toEqual(input);
      expect(validated).not.toBe(input);
      expect(validated.contentType).toBe(contentType);
    },
  );

  it('accepts a matching XLSX ZIP signature', () => {
    const input = {
      originalName: 'cakes.xlsx',
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: createXlsx(),
    };

    expect(validateXlsxMediaFile(input)).toEqual(input);
  });

  it.each([
    [
      'extension/header mismatch',
      { originalName: 'cake.jpg', contentType: 'image/png', buffer: png },
    ],
    [
      'declared MIME/header mismatch',
      { originalName: 'cake.jpg', contentType: 'image/jpeg', buffer: png },
    ],
    [
      'SVG',
      {
        originalName: 'cake.svg',
        contentType: 'image/svg+xml',
        buffer: Buffer.from('<svg></svg>'),
      },
    ],
    [
      'HTML disguised as PNG',
      {
        originalName: 'cake.png',
        contentType: 'image/png',
        buffer: Buffer.from('<html></html>'),
      },
    ],
  ])('rejects %s as 415', (_name, input) => {
    expect(() => validateImageMediaFile(input)).toThrow(
      new UnsupportedMediaFileException(MEDIA_FILE_SIGNATURE_MISMATCH_MESSAGE),
    );
  });

  it('rejects a non-ZIP payload disguised as XLSX as 415', () => {
    expect(() =>
      validateXlsxMediaFile({
        originalName: 'cakes.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('<html></html>'),
      }),
    ).toThrow(UnsupportedMediaFileException);
  });
});
