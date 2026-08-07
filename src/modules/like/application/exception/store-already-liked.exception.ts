import { HttpStatus } from '@nestjs/common';
import { CustomException } from 'src/platform/http/custom-exception';

export class StoreAlreadyLikedException extends CustomException {
  constructor(id: string) {
    super(`매장(${id})을 이미 좋아요 하셨습니다.`, HttpStatus.NOT_FOUND);
  }
}
