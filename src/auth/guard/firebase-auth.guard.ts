import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Roles } from 'src/user/entities/roles.enum';
import { HOME_RESILIENCE_AUTH_BYPASS_KEY } from '../decorators/home-resilience-auth-bypass.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class FirebaseAuthGuard extends AuthGuard('firebase-auth') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    if (process.env.NODE_ENV === 'development') {
      context.switchToHttp().getRequest().user = {
        firebaseUid: 'dev-mock-user',
        nickname: 'dev',
        oauth_provider: 'dev',
        roles: [Roles.BUYER],
        cake_like_ids: [],
        store_like_ids: [],
      };
      return true;
    }

    const allowHomeResilienceAuthBypass =
      this.reflector.getAllAndOverride<boolean>(
        HOME_RESILIENCE_AUTH_BYPASS_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (
      process.env.HOME_RESILIENCE_AUTH_BYPASS === 'true' &&
      allowHomeResilienceAuthBypass
    ) {
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
