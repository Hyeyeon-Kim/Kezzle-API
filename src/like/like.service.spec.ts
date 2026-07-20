import { CakeAlredyLikeException } from 'src/cake/exceptions/cake-already-like.exception';
import { StoreAlredyLikeException } from 'src/store/exceptions/store-already-like.exception';
import { LikeService } from './like.service';

const viewer = { firebaseUid: 'viewer-user', roles: [] };

const buildService = ({
  userLikePort = {},
  cakeLikePort = {},
  storeLikePort = {},
  likedStoreReader = {},
  logService = {},
}: Record<string, any>) =>
  new LikeService(
    userLikePort as any,
    cakeLikePort as any,
    storeLikePort as any,
    likedStoreReader as any,
    logService as any,
  );

const expectCallOrder = (...mocks: jest.Mock[]) => {
  const order = mocks.map((mock) => mock.mock.invocationCallOrder[0]);
  expect(order).toEqual([...order].sort((a, b) => a - b));
};

describe('LikeService public port boundary', () => {
  it('reads liked cakes through UserLikePort and CakeLikePort', async () => {
    const userLikePort = {
      findByFirebaseUidOrThrow: jest.fn().mockResolvedValue({
        firebaseUid: 'target-user',
        cakeLikeIds: ['cake-1'],
        storeLikeIds: [],
      }),
    };
    const cakeLikePort = {
      findByIds: jest.fn().mockResolvedValue([
        {
          id: 'cake-1',
          image: {},
          ownerStoreId: 'store-1',
          likedUserIds: ['target-user'],
          cursor: 'cursor-1',
          tags: [],
        },
      ]),
    };
    const service = buildService({ userLikePort, cakeLikePort });

    const result = await service.findUserLikeCake('target-user');

    expect(userLikePort.findByFirebaseUidOrThrow).toHaveBeenCalledWith(
      'target-user',
    );
    expect(cakeLikePort.findByIds).toHaveBeenCalledWith(['cake-1']);
    expect(result).toEqual([expect.objectContaining({ id: 'cake-1' })]);
  });

  it('reads liked stores through one catalog reader and preserves target/viewer like semantics', async () => {
    const userLikePort = {
      findByFirebaseUidOrThrow: jest.fn().mockResolvedValue({
        firebaseUid: 'target-user',
        cakeLikeIds: [],
        storeLikeIds: ['store-1'],
      }),
    };
    const likedStoreReader = {
      findByUserLike: jest.fn().mockResolvedValue([
        {
          id: 'store-1',
          name: 'Store 1',
          logo: {},
          address: 'Seoul',
          likedUserIds: ['target-user'],
          cakes: [
            {
              id: 'cake-1',
              image: {},
              ownerStoreId: 'store-1',
              likedUserIds: ['viewer-user'],
              cursor: 'cursor-1',
              tags: [],
            },
          ],
        },
      ]),
    };
    const service = buildService({ userLikePort, likedStoreReader });

    const result = await service.findUserLikeStore('target-user');

    expect(likedStoreReader.findByUserLike).toHaveBeenCalledTimes(1);
    expect(likedStoreReader.findByUserLike).toHaveBeenCalledWith('target-user');
    expect(result[0]).toMatchObject({ id: 'store-1' });
    expect(result[0].cakes[0]).toMatchObject({
      id: 'cake-1',
    });
  });

  it('keeps cake add dual-write and log order', async () => {
    const cakeLikePort = {
      findTargetOrThrow: jest.fn().mockResolvedValue({ likedUserIds: [] }),
      addUserLike: jest.fn().mockResolvedValue(undefined),
    };
    const userLikePort = {
      addCakeLike: jest.fn().mockResolvedValue(undefined),
    };
    const logService = { cakeLikelog: jest.fn() };
    const service = buildService({
      cakeLikePort,
      userLikePort,
      logService,
    });

    await expect(
      service.cakeAddLikeList('cake-1', viewer as any),
    ).resolves.toBe(true);

    expectCallOrder(
      cakeLikePort.findTargetOrThrow,
      cakeLikePort.addUserLike,
      userLikePort.addCakeLike,
      logService.cakeLikelog,
    );
    expect(logService.cakeLikelog).toHaveBeenCalledWith(
      'viewer-user',
      'cake-1',
      true,
    );
  });

  it('keeps CakeAlredyLikeException and skips both writes for a duplicate', async () => {
    const cakeLikePort = {
      findTargetOrThrow: jest
        .fn()
        .mockResolvedValue({ likedUserIds: ['viewer-user'] }),
      addUserLike: jest.fn(),
    };
    const userLikePort = { addCakeLike: jest.fn() };
    const service = buildService({ cakeLikePort, userLikePort });

    await expect(
      service.cakeAddLikeList('cake-1', viewer as any),
    ).rejects.toBeInstanceOf(CakeAlredyLikeException);
    expect(cakeLikePort.addUserLike).not.toHaveBeenCalled();
    expect(userLikePort.addCakeLike).not.toHaveBeenCalled();
  });

  it('keeps cake remove dual-write and log order', async () => {
    const cakeLikePort = {
      findTargetOrThrow: jest.fn().mockResolvedValue({ likedUserIds: [] }),
      removeUserLike: jest.fn().mockResolvedValue(undefined),
    };
    const userLikePort = {
      removeCakeLike: jest.fn().mockResolvedValue(undefined),
    };
    const logService = { cakeLikelog: jest.fn() };
    const service = buildService({
      cakeLikePort,
      userLikePort,
      logService,
    });

    await service.cakeRemoveLikeList('cake-1', viewer as any);

    expectCallOrder(
      cakeLikePort.findTargetOrThrow,
      cakeLikePort.removeUserLike,
      userLikePort.removeCakeLike,
      logService.cakeLikelog,
    );
  });

  it('keeps store add dual-write order and duplicate exception', async () => {
    const storeLikePort = {
      findTargetOrThrow: jest.fn().mockResolvedValueOnce({ likedUserIds: [] }),
      addUserLike: jest.fn().mockResolvedValue(undefined),
    };
    const userLikePort = {
      addStoreLike: jest.fn().mockResolvedValue(undefined),
    };
    const service = buildService({ storeLikePort, userLikePort });

    await service.storeAddLikeList('store-1', viewer as any);
    expectCallOrder(
      storeLikePort.findTargetOrThrow,
      storeLikePort.addUserLike,
      userLikePort.addStoreLike,
    );

    storeLikePort.findTargetOrThrow.mockResolvedValueOnce({
      likedUserIds: ['viewer-user'],
    });
    await expect(
      service.storeAddLikeList('store-1', viewer as any),
    ).rejects.toBeInstanceOf(StoreAlredyLikeException);
    expect(storeLikePort.addUserLike).toHaveBeenCalledTimes(1);
    expect(userLikePort.addStoreLike).toHaveBeenCalledTimes(1);
  });

  it('keeps store remove dual-write order', async () => {
    const storeLikePort = {
      findTargetOrThrow: jest.fn().mockResolvedValue({ likedUserIds: [] }),
      removeUserLike: jest.fn().mockResolvedValue(undefined),
    };
    const userLikePort = {
      removeStoreLike: jest.fn().mockResolvedValue(undefined),
    };
    const service = buildService({ storeLikePort, userLikePort });

    await service.storeRemoveLikeList('store-1', viewer as any);

    expectCallOrder(
      storeLikePort.findTargetOrThrow,
      storeLikePort.removeUserLike,
      userLikePort.removeStoreLike,
    );
  });
});
