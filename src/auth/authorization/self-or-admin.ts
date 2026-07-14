import { ForbiddenException } from '@nestjs/common';
import { Roles } from 'src/user/entities/roles.enum';
import IUser from 'src/user/interfaces/user.interface';

export function assertSelfOrAdmin(
  user: IUser,
  targetFirebaseUid: string,
): void {
  if (
    user.firebaseUid === targetFirebaseUid ||
    user.roles.includes(Roles.ADMIN)
  ) {
    return;
  }

  throw new ForbiddenException('다른 사용자의 리소스에 접근할 수 없습니다.');
}
