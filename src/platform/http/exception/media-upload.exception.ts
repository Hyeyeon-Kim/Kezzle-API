import { HttpStatus } from '@nestjs/common';
import { CustomException } from '../custom-exception';

export class MediaUploadException extends CustomException {
  constructor() {
    super('S3에 업로드 하는 도중 오류 발생', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
