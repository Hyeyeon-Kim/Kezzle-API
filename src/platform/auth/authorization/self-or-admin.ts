import { ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from 'src/platform/auth/authenticated-user';
import { Roles } from 'src/platform/auth/roles.enum';

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
