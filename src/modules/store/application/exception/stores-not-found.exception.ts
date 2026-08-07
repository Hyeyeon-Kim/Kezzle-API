import { HttpStatus } from '@nestjs/common';
import { CustomException } from 'src/platform/http/custom-exception';

export class StoresNotFoundException extends CustomException {
  constructor() {
    super(`매장들 정보를 찾을 수 없습니다.`, HttpStatus.NOT_FOUND);
  }
}
