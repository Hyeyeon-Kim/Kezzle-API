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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const config = {
    nodeEnv: 'test',
    developmentBypass: false,
    homeResilienceBypass: true,
    homeResilienceUserId: 'load-test-user',
    homeResilienceCakeLikeIds: ['cake-1', 'cake-2'],
  };

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
    const request: any = {};
    const context = createContext(request);
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true),
    } as unknown as Reflector;
    const guard = new FirebaseAuthGuard(reflector, config);

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
    const request: any = {};
    const context = createContext(request);
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const guard = new FirebaseAuthGuard(reflector, config);

    expect(guard.canActivate(context)).toBe('passport-can-activate');
    expect(request.user).toBeUndefined();
  });

  it('keeps public routes public before checking home resilience bypass metadata', () => {
    const request: any = {};
    const context = createContext(request);
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new FirebaseAuthGuard(reflector, config);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toBeUndefined();
    expect(reflector.getAllAndOverride).toHaveBeenCalledTimes(1);
  });

  it('requires an explicit flag for development authentication bypass', () => {
    const request: any = {};
    const context = createContext(request);
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;

    const disabled = new FirebaseAuthGuard(reflector, {
      ...config,
      nodeEnv: 'development',
      developmentBypass: false,
      homeResilienceBypass: false,
    });
    expect(disabled.canActivate(context)).toBe('passport-can-activate');

    const enabled = new FirebaseAuthGuard(reflector, {
      ...config,
      nodeEnv: 'development',
      developmentBypass: true,
      homeResilienceBypass: false,
    });
    expect(enabled.canActivate(context)).toBe(true);
    expect(request.user).toMatchObject({ firebaseUid: 'dev-mock-user' });
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
