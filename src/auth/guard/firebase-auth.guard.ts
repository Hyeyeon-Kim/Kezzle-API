import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Roles } from 'src/user/entities/roles.enum';

@Injectable()
export class FirebaseAuthGuard extends AuthGuard('firebase-auth') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (process.env.NODE_ENV === 'development') {
      context.switchToHttp().getRequest().user = {
        firebaseUid: 'dev-mock-user',
        nickname: 'dev',
        oauth_provider: 'dev',
        roles: Roles.BUYER,
        cake_like_ids: [],
        store_like_ids: [],
      };
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>('public', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}
