import { MediaFile } from '../application/media-file';

export interface MulterFileSource {
  readonly originalname: string;
  readonly mimetype: string;
  readonly buffer: Buffer;
}

export class MulterMediaFileMapper {
  static toMediaFile(file: MulterFileSource): MediaFile;
  static toMediaFile(file: undefined): undefined;
  static toMediaFile(
    file: MulterFileSource | undefined,
  ): MediaFile | undefined {
    if (file === undefined) return undefined;

    return {
      originalName: file.originalname,
      contentType: file.mimetype,
      buffer: file.buffer,
    };
  }

  static toMediaFiles(files: MulterFileSource[] | undefined): MediaFile[] {
    return (files ?? []).map((file) => this.toMediaFile(file));
  }
}
