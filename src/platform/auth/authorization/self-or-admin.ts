import { ForbiddenException } from '@nestjs/common';
import { Roles } from 'src/modules/user/entities/roles.enum';
import { AuthenticatedUser } from 'src/modules/user/application/authenticated-user';

export function assertSelfOrAdmin(
  user: AuthenticatedUser,
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
