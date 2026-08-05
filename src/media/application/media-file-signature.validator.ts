import { extname } from 'path';
import { UnsupportedMediaFileException } from 'src/media/exception/unsupported-media-file.exception';
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
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const ZIP_MAX_COMMENT_SIZE = 0xffff;
const XLSX_REQUIRED_ENTRIES = [
  '[Content_Types].xml',
  '_rels/.rels',
  'xl/workbook.xml',
] as const;

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

function findZipEndOfCentralDirectory(buffer: Buffer): number | undefined {
  const firstCandidate = buffer.length - ZIP_END_OF_CENTRAL_DIRECTORY_SIZE;
  const lastCandidate = Math.max(0, firstCandidate - ZIP_MAX_COMMENT_SIZE);

  for (let offset = firstCandidate; offset >= lastCandidate; offset--) {
    if (
      buffer.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE
    ) {
      return offset;
    }
  }
  return undefined;
}

function zipEntryNames(buffer: Buffer): ReadonlySet<string> | undefined {
  if (buffer.length < ZIP_END_OF_CENTRAL_DIRECTORY_SIZE) return undefined;

  const endOffset = findZipEndOfCentralDirectory(buffer);
  if (endOffset === undefined) return undefined;

  const diskNumber = buffer.readUInt16LE(endOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(endOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(endOffset + 8);
  const totalEntries = buffer.readUInt16LE(endOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  const commentLength = buffer.readUInt16LE(endOffset + 20);

  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== totalEntries ||
    endOffset + ZIP_END_OF_CENTRAL_DIRECTORY_SIZE + commentLength !==
      buffer.length ||
    centralDirectoryOffset + centralDirectorySize !== endOffset
  ) {
    return undefined;
  }

  const entries = new Set<string>();
  let offset = centralDirectoryOffset;
  for (let index = 0; index < totalEntries; index++) {
    if (
      offset + 46 > endOffset ||
      buffer.readUInt32LE(offset) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE
    ) {
      return undefined;
    }

    const flags = buffer.readUInt16LE(offset + 8);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const nextOffset =
      offset + 46 + fileNameLength + extraFieldLength + fileCommentLength;
    if ((flags & 0x1) !== 0 || nextOffset > endOffset) return undefined;

    entries.add(
      buffer
        .subarray(offset + 46, offset + 46 + fileNameLength)
        .toString('utf8'),
    );
    offset = nextOffset;
  }

  return offset === endOffset ? entries : undefined;
}

function hasXlsxStructure(buffer: Buffer): boolean {
  const entries = zipEntryNames(buffer);
  if (entries === undefined) return false;
  if (!XLSX_REQUIRED_ENTRIES.every((entry) => entries.has(entry))) return false;
  if (
    ![...entries].some(
      (entry) => entry.startsWith('xl/worksheets/') && entry.endsWith('.xml'),
    )
  ) {
    return false;
  }

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
