import { HttpStatus } from '@nestjs/common';
import { CustomException } from 'src/platform/http/custom-exception';

export class UserNotOwnerException extends CustomException {
  constructor(userId: string, storeId: string) {
    super(
      `userid(${userId})가 매장(${storeId})의 소유자가 아닙니다`,
      HttpStatus.FORBIDDEN,
    );
  }
}
