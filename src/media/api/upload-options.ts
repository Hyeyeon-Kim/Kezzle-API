import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import {
  EXCEL_MAX_BYTES,
  IMAGE_MAX_BYTES,
  IMPORT_MAX_FILE_COUNT,
  SINGLE_IMAGE_MAX_FILE_COUNT,
} from './upload-limits';

export function singleImageUploadOptions(): MulterOptions {
  return {
    limits: {
      fileSize: IMAGE_MAX_BYTES,
      files: SINGLE_IMAGE_MAX_FILE_COUNT,
    },
  };
}

export function cakeImportUploadOptions(): MulterOptions {
  return {
    limits: {
      // Multer applies one fileSize limit to every field in a multipart form.
      // Use the stricter XLSX cap for both Excel and bulk-import images.
      fileSize: EXCEL_MAX_BYTES,
      files: IMPORT_MAX_FILE_COUNT,
    },
  };
}
