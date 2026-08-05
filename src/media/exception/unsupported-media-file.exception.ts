import { HttpException, HttpStatus } from '@nestjs/common';

export class UnsupportedMediaFileException extends HttpException {
  constructor(message: string) {
    super(
      {
        message,
        error: 'Unsupported Media Type',
        statusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      },
      HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    );
  }
}
