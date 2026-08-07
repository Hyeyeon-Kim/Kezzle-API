import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Roles } from 'src/user/domain/roles.enum';
import { HOME_RESILIENCE_AUTH_BYPASS_KEY } from '../decorators/home-resilience-auth-bypass.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import authConfig from 'src/config/auth.config';

@Injectable()
export class FirebaseAuthGuard extends AuthGuard('firebase-auth') {
  constructor(
    private reflector: Reflector,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {
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

    if (
      this.config.nodeEnv === 'development' &&
      this.config.developmentBypass
    ) {
      context.switchToHttp().getRequest().user = {
        firebaseUid: 'dev-mock-user',
        nickname: 'dev',
        oauthProvider: 'dev',
        roles: [Roles.BUYER],
        cakeLikeIds: [],
        storeLikeIds: [],
      };
      return true;
    }

    const allowHomeResilienceAuthBypass =
      this.reflector.getAllAndOverride<boolean>(
        HOME_RESILIENCE_AUTH_BYPASS_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (this.config.homeResilienceBypass && allowHomeResilienceAuthBypass) {
      const request = context.switchToHttp().getRequest();
      request.user = {
        firebaseUid: this.config.homeResilienceUserId,
        nickname: 'home-resilience',
        oauthProvider: 'local',
        roles: [Roles.BUYER],
        cakeLikeIds: this.config.homeResilienceCakeLikeIds,
        storeLikeIds: [],
      };
      return true;
    }

    return super.canActivate(context);
  }
}
