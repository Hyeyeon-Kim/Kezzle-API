import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { S3UploadException } from './exception/s3-upload.exception';
import { S3DeleteException } from './exception/s3-delete.exception';
import { ImageValue } from 'src/common/image/application/image.value';
import { MediaFile } from './application/media-file';
import { ObjectStoragePort } from './application/object-storage.port';
import { ObjectStorageError } from './application/object-storage.error';

@Injectable()
export class UploadService {
  constructor(private readonly objectStorage: ObjectStoragePort) {}

  async create(parentDirectory: string, file: MediaFile): Promise<ImageValue> {
    const extension = file.originalName.split('.').pop();
    const convertedName = randomUUID() + '.' + extension;
    const key = `${parentDirectory}/${convertedName}`;

    try {
      const stored = await this.objectStorage.put({
        key,
        body: file.buffer,
        contentType: file.contentType,
      });
      return {
        name: file.originalName,
        converteName: convertedName,
        key: stored.key,
        s3Url: stored.url,
      };
    } catch (error) {
      if (error instanceof ObjectStorageError) {
        throw new S3UploadException();
      }
      throw error;
    }
  }

  async remove(parentDirectory: string, s3Url: string): Promise<void> {
    const parts = s3Url.split('/');
    const fileName = parts[parts.length - 1];

    const key = `${parentDirectory}/${fileName}`;

    try {
      await this.objectStorage.delete(key);
    } catch (error) {
      if (error instanceof ObjectStorageError) {
        throw new S3DeleteException();
      }
      throw error;
    }
  }
}
