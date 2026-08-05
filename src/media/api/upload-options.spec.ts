import { UnsupportedMediaTypeException } from '@nestjs/common';
import {
  EXCEL_MAX_BYTES,
  IMAGE_MAX_BYTES,
  IMPORT_MAX_EXCEL_COUNT,
  IMPORT_MAX_FILE_COUNT,
  IMPORT_MAX_IMAGE_COUNT,
  SINGLE_IMAGE_MAX_FILE_COUNT,
} from './upload-limits';
import {
  cakeImportUploadOptions,
  singleImageUploadOptions,
  UNSUPPORTED_UPLOAD_MEDIA_TYPE_MESSAGE,
} from './upload-options';

function applyFileFilter(
  options: ReturnType<typeof singleImageUploadOptions>,
  fieldname: string,
  mimetype: string,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    options.fileFilter?.(
      {} as never,
      { fieldname, mimetype } as never,
      (error, accepted) => {
        if (error) reject(error);
        else resolve(accepted);
      },
    );
  });
}

describe('Upload interceptor options', () => {
  it('caps single-image uploads at one 10 MiB file', () => {
    expect(singleImageUploadOptions().limits).toEqual({
      fileSize: IMAGE_MAX_BYTES,
      files: SINGLE_IMAGE_MAX_FILE_COUNT,
    });
    expect(IMAGE_MAX_BYTES).toBe(10 * 1024 * 1024);
  });

  it('caps cake import at 3000 images plus one XLSX', () => {
    expect(cakeImportUploadOptions().limits).toEqual({
      fileSize: EXCEL_MAX_BYTES,
      files: IMPORT_MAX_FILE_COUNT,
    });
    expect(EXCEL_MAX_BYTES).toBe(5 * 1024 * 1024);
    expect(IMPORT_MAX_IMAGE_COUNT).toBe(3000);
    expect(IMPORT_MAX_EXCEL_COUNT).toBe(1);
    expect(IMPORT_MAX_FILE_COUNT).toBe(3001);
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'])(
    'allows %s on single-image fields',
    async (mimetype) => {
      await expect(
        applyFileFilter(singleImageUploadOptions(), 'file', mimetype),
      ).resolves.toBe(true);
    },
  );

  it.each(['image/svg+xml', 'text/html', 'application/octet-stream'])(
    'rejects %s on single-image fields as 415',
    async (mimetype) => {
      await expect(
        applyFileFilter(singleImageUploadOptions(), 'file', mimetype),
      ).rejects.toEqual(
        new UnsupportedMediaTypeException(
          UNSUPPORTED_UPLOAD_MEDIA_TYPE_MESSAGE,
        ),
      );
    },
  );

  it('applies field-specific image and XLSX allowlists to cake imports', async () => {
    const options = cakeImportUploadOptions();

    await expect(applyFileFilter(options, 'image', 'image/webp')).resolves.toBe(
      true,
    );
    await expect(
      applyFileFilter(
        options,
        'excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    ).resolves.toBe(true);
    await expect(
      applyFileFilter(options, 'excel', 'image/png'),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    await expect(
      applyFileFilter(
        options,
        'image',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
  });
});
