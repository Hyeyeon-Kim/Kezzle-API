import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from 'src/user/domain/roles.enum';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  function createContext(roles: Roles[] = [Roles.BUYER]): ExecutionContext {
    return {
      getClass: jest.fn(),
      getHandler: jest.fn(),
      switchToHttp: jest.fn(() => ({
        getRequest: jest.fn(() => ({ user: { roles } })),
      })),
    } as unknown as ExecutionContext;
  }

  it('allows authenticated routes without role metadata', async () => {
    const reflector = {
      getAllAndMerge: jest.fn().mockReturnValue(undefined),
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;

    await expect(
      new RolesGuard(reflector).canActivate(createContext()),
    ).resolves.toBe(true);
  });

  it('allows only a matching role for a role-protected route', async () => {
    const reflector = {
      getAllAndMerge: jest.fn().mockReturnValue([Roles.ADMIN]),
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;

    await expect(
      new RolesGuard(reflector).canActivate(createContext([Roles.BUYER])),
    ).resolves.toBe(false);
    await expect(
      new RolesGuard(reflector).canActivate(createContext([Roles.ADMIN])),
    ).resolves.toBe(true);
  });
});
