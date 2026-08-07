import { HttpStatus } from '@nestjs/common';
import { CustomException } from 'src/platform/http/custom-exception';

export class UserAlreadyJoinedException extends CustomException {
  constructor(id: string) {
    super(`이미 가입된 회원입니다 (${id}).`, HttpStatus.NOT_FOUND);
  }
}
