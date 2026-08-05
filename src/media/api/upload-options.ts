import { UnsupportedMediaTypeException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import {
  ALLOWED_EXCEL_MIME_TYPES,
  ALLOWED_IMAGE_MIME_TYPES,
  EXCEL_MAX_BYTES,
  IMAGE_MAX_BYTES,
  IMPORT_MAX_FILE_COUNT,
  SINGLE_IMAGE_MAX_FILE_COUNT,
} from './upload-limits';

export const UNSUPPORTED_UPLOAD_MEDIA_TYPE_MESSAGE =
  'Unsupported upload media type';

const imageMimeTypes = new Set<string>(ALLOWED_IMAGE_MIME_TYPES);
const excelMimeTypes = new Set<string>(ALLOWED_EXCEL_MIME_TYPES);

function rejectUnsupportedMediaType(
  callback: Parameters<NonNullable<MulterOptions['fileFilter']>>[2],
): void {
  callback(
    new UnsupportedMediaTypeException(UNSUPPORTED_UPLOAD_MEDIA_TYPE_MESSAGE),
    false,
  );
}

const imageFileFilter: NonNullable<MulterOptions['fileFilter']> = (
  _request,
  file,
  callback,
) => {
  if (imageMimeTypes.has(file.mimetype)) {
    callback(null, true);
    return;
  }
  rejectUnsupportedMediaType(callback);
};

const cakeImportFileFilter: NonNullable<MulterOptions['fileFilter']> = (
  _request,
  file,
  callback,
) => {
  const isAllowed =
    (file.fieldname === 'image' && imageMimeTypes.has(file.mimetype)) ||
    (file.fieldname === 'excel' && excelMimeTypes.has(file.mimetype));
  if (isAllowed) {
    callback(null, true);
    return;
  }
  rejectUnsupportedMediaType(callback);
};

export function singleImageUploadOptions(): MulterOptions {
  return {
    fileFilter: imageFileFilter,
    limits: {
      fileSize: IMAGE_MAX_BYTES,
      files: SINGLE_IMAGE_MAX_FILE_COUNT,
    },
  };
}

export function cakeImportUploadOptions(): MulterOptions {
  return {
    fileFilter: cakeImportFileFilter,
    limits: {
      // Multer applies one fileSize limit to every field in a multipart form.
      // Use the stricter XLSX cap for both Excel and bulk-import images.
      fileSize: EXCEL_MAX_BYTES,
      files: IMPORT_MAX_FILE_COUNT,
    },
  };
}
