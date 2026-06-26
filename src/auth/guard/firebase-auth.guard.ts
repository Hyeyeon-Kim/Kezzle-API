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
    const isPublic = this.reflector.getAllAndOverride<boolean>('public', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    if (process.env.HOME_RESILIENCE_AUTH_BYPASS === 'true') {
      const request = context.switchToHttp().getRequest();
      request.user = {
        firebaseUid:
          process.env.HOME_RESILIENCE_USER_ID ?? 'home-resilience-user',
        nickname: 'home-resilience',
        oauth_provider: 'local',
        roles: [Roles.BUYER],
        cake_like_ids: (process.env.HOME_RESILIENCE_CAKE_LIKE_IDS ?? '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
        store_like_ids: [],
      };
      return true;
    }

    return super.canActivate(context);
  }
}
