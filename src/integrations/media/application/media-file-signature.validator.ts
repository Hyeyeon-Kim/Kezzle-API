import { extname } from 'path';
import { UnsupportedMediaFileException } from 'src/platform/http/exception/unsupported-media-file.exception';
import * as XLSX from 'xlsx';
import { MediaFile } from './media-file';

export const MEDIA_FILE_SIGNATURE_MISMATCH_MESSAGE =
  'File content does not match its media type';

type ImageContentType = 'image/jpeg' | 'image/png' | 'image/webp';
type ExcelContentType =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const IMAGE_EXTENSIONS: Record<ImageContentType, readonly string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};
const XLSX_CONTENT_TYPE: ExcelContentType =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function startsWith(buffer: Buffer, signature: readonly number[]): boolean {
  return (
    buffer.length >= signature.length &&
    signature.every((value, index) => buffer[index] === value)
  );
}

function detectImageContentType(buffer: Buffer): ImageContentType | undefined {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return undefined;
}

function hasXlsxStructure(buffer: Buffer): boolean {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    return (
      workbook.SheetNames.length > 0 &&
      workbook.Sheets[workbook.SheetNames[0]] !== undefined
    );
  } catch {
    return false;
  }
}

function rejectSignatureMismatch(): never {
  throw new UnsupportedMediaFileException(
    MEDIA_FILE_SIGNATURE_MISMATCH_MESSAGE,
  );
}

export function validateImageMediaFile(file: MediaFile): MediaFile {
  const detectedContentType = detectImageContentType(file.buffer);
  if (detectedContentType === undefined) rejectSignatureMismatch();

  const extension = extname(file.originalName).toLowerCase();
  if (
    file.contentType !== detectedContentType ||
    !IMAGE_EXTENSIONS[detectedContentType].includes(extension)
  ) {
    rejectSignatureMismatch();
  }

  return { ...file, contentType: detectedContentType };
}

export function validateXlsxMediaFile(file: MediaFile): MediaFile {
  const hasZipSignature = startsWith(file.buffer, [0x50, 0x4b, 0x03, 0x04]);
  if (
    !hasZipSignature ||
    file.contentType !== XLSX_CONTENT_TYPE ||
    extname(file.originalName).toLowerCase() !== '.xlsx' ||
    !hasXlsxStructure(file.buffer)
  ) {
    rejectSignatureMismatch();
  }

  return { ...file, contentType: XLSX_CONTENT_TYPE };
}
