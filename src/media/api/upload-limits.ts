const MEBIBYTE = 1024 * 1024;

export const IMAGE_MAX_BYTES = 10 * MEBIBYTE;
export const EXCEL_MAX_BYTES = 5 * MEBIBYTE;
export const SINGLE_IMAGE_MAX_FILE_COUNT = 1;
export const IMPORT_MAX_IMAGE_COUNT = 3000;
export const IMPORT_MAX_EXCEL_COUNT = 1;
export const IMPORT_MAX_FILE_COUNT =
  IMPORT_MAX_IMAGE_COUNT + IMPORT_MAX_EXCEL_COUNT;

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export const ALLOWED_EXCEL_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;
