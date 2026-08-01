import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HomeController } from 'src/home/home.controller';
import {
  AllowHomeResilienceAuthBypass,
  HOME_RESILIENCE_AUTH_BYPASS_KEY,
} from '../decorators/home-resilience-auth-bypass.decorator';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { Roles } from 'src/user/entities/roles.enum';

jest.mock('@nestjs/passport', () => ({
  AuthGuard: jest.fn(
    () =>
      class {
        canActivate() {
          return 'passport-can-activate';
        }
      },
  ),
}));

describe('FirebaseAuthGuard home resilience auth bypass scope', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function createContext(request = {}): ExecutionContext {
    return {
      getClass: jest.fn(),
      getHandler: jest.fn(),
      switchToHttp: jest.fn(() => ({
        getRequest: jest.fn(() => request),
      })),
    } as unknown as ExecutionContext;
  }

  it('allows synthetic user only for handlers with home resilience bypass metadata', () => {
    process.env.HOME_RESILIENCE_AUTH_BYPASS = 'true';
    process.env.HOME_RESILIENCE_USER_ID = 'load-test-user';
    process.env.HOME_RESILIENCE_CAKE_LIKE_IDS = 'cake-1, cake-2';

    const request: any = {};
    const context = createContext(request);
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true),
    } as unknown as Reflector;
    const guard = new FirebaseAuthGuard(reflector);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toMatchObject({
      firebaseUid: 'load-test-user',
      nickname: 'home-resilience',
      oauthProvider: 'local',
      cakeLikeIds: ['cake-1', 'cake-2'],
      storeLikeIds: [],
    });
    expect(request.user.roles).toContain(Roles.BUYER);
  });

  it('delegates to Passport for protected handlers without bypass metadata', () => {
    process.env.HOME_RESILIENCE_AUTH_BYPASS = 'true';

    const request: any = {};
    const context = createContext(request);
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new FirebaseAuthGuard(reflector);

    expect(guard.canActivate(context)).toBe('passport-can-activate');
    expect(request.user).toBeUndefined();
  });

  it('keeps public routes public before checking home resilience bypass metadata', () => {
    process.env.HOME_RESILIENCE_AUTH_BYPASS = 'true';

    const request: any = {};
    const context = createContext(request);
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new FirebaseAuthGuard(reflector);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toBeUndefined();
    expect(reflector.getAllAndOverride).toHaveBeenCalledTimes(1);
  });

  it('marks only the Home handler for home resilience auth bypass', () => {
    expect(
      Reflect.getMetadata(
        HOME_RESILIENCE_AUTH_BYPASS_KEY,
        HomeController.prototype.getHome,
      ),
    ).toBe(true);
  });

  it('exports a decorator that sets the expected metadata key', () => {
    class TestController {
      @AllowHomeResilienceAuthBypass()
      handler() {
        return undefined;
      }
    }

    expect(
      Reflect.getMetadata(
        HOME_RESILIENCE_AUTH_BYPASS_KEY,
        TestController.prototype.handler,
      ),
    ).toBe(true);
  });
});
