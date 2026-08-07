import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from 'src/user/application/authenticated-user';

/**
 * Returns user
 */
export const GetUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request: { user: AuthenticatedUser } = ctx
      .switchToHttp()
      .getRequest();
    return request.user;
  },
);
