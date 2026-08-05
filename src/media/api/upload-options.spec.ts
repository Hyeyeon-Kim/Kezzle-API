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
} from './upload-options';

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
});
