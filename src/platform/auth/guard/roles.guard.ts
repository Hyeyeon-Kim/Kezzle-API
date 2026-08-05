import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from 'src/modules/user/application/roles.enum';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndMerge<Roles[]>('roles', [
      context.getClass(),
      context.getHandler(),
    ]);

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic || !roles || roles.length === 0) {
      return true;
    }

    const userRoles = context.switchToHttp().getRequest().user?.roles ?? [];
    return roles.some((role) => userRoles.includes(role));
  }
}
