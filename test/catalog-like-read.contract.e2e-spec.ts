import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CakeController } from 'src/cake/cake.controller';
import { CakeService } from 'src/cake/cake.service';
import { CatalogCakeController } from 'src/catalog/catalog-cake.controller';
import { CatalogQueryService } from 'src/catalog/catalog-query.service';
import { CatalogStoreController } from 'src/catalog/catalog-store.controller';
import { SimilarCakeCatalogQueryService } from 'src/catalog/similar-cake-catalog-query.service';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { LikeController } from 'src/like/like.controller';
import { LikeService } from 'src/like/like.service';
import { StoreController } from 'src/store/store.controller';
import { StoreService } from 'src/store/store.service';
import { Roles } from 'src/user/entities/roles.enum';
import fixtures from './fixtures/catalog-like-read.contract.json';

@Injectable()
class ContractAuthenticationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    const [role, firebaseUid] = authorization
      .slice('Bearer '.length)
      .split(':');
    const rolesByToken = {
      admin: Roles.ADMIN,
      buyer: Roles.BUYER,
      seller: Roles.SELLER,
    } as const;
    const resolvedRole = rolesByToken[role];

    if (!resolvedRole || !firebaseUid) {
      throw new UnauthorizedException();
    }

    request.user = {
      firebaseUid,
      nickname: `contract-${role}`,
      oauthProvider: 'contract',
      roles: [resolvedRole],
      cakeLikeIds: [],
      storeLikeIds: [],
    };
    return true;
  }
}

describe('Catalog/Like read HTTP contract', () => {
  let app: INestApplication;

  const catalogQuery = {
    findAllCakes: jest.fn(),
    findAllCakesByLocation: jest.fn(),
    findStoreCakes: jest.fn(),
    findAllStores: jest.fn(),
  };
  const similarCakeQuery = { execute: jest.fn() };
  const cakeService = {};
  const storeService = {
    create: jest.fn(),
  };
  const likeService = {
    findUserLikeCake: jest.fn(),
    findUserLikeStore: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        CatalogCakeController,
        CatalogStoreController,
        CakeController,
        StoreController,
        LikeController,
      ],
      providers: [
        { provide: CatalogQueryService, useValue: catalogQuery },
        {
          provide: SimilarCakeCatalogQueryService,
          useValue: similarCakeQuery,
        },
        { provide: CakeService, useValue: cakeService },
        { provide: StoreService, useValue: storeService },
        { provide: LikeService, useValue: likeService },
        {
          provide: APP_GUARD,
          useClass: ContractAuthenticationGuard,
        },
        {
          provide: APP_GUARD,
          useClass: RolesGuard,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    catalogQuery.findAllCakes.mockResolvedValue(fixtures.cakesByCursor);
    catalogQuery.findAllCakesByLocation.mockResolvedValue(
      fixtures.cakesByLocation,
    );
    catalogQuery.findStoreCakes.mockResolvedValue(fixtures.storeCakes);
    catalogQuery.findAllStores.mockResolvedValue(fixtures.stores);
    similarCakeQuery.execute.mockResolvedValue(fixtures.similarCakes);
    storeService.create.mockResolvedValue(fixtures.createdStore);
    likeService.findUserLikeCake.mockResolvedValue(fixtures.likedCakes);
    likeService.findUserLikeStore.mockResolvedValue(fixtures.likedStores);
  });

  afterAll(async () => {
    await app.close();
  });

  const protectedRoutes = [
    '/cakes?latitude=37.5&longitude=127.1&dist=3000&after=cursor-0&count=1',
    '/cakes/location?latitude=37.5&longitude=127.1&dist=3000&after=65a000000000000000000000&count=1',
    '/stores?latitude=37.5&longitude=127.1&dist=3000&after=0&count=1',
    '/stores/store-1/cakes?after=65a000000000000000000000&count=1',
    '/cakes/cake-1/similar?latitude=37.5&longitude=127.1&dist=3000&size=6',
    '/users/user-1/liked-cakes',
    '/users/user-1/liked-stores',
  ];

  it.each(protectedRoutes)('rejects anonymous GET %s', async (path) => {
    await request(app.getHttpServer()).get(path).expect(401);
  });

  it('keeps GET /cakes query conversion and response fixture', async () => {
    const response = await request(app.getHttpServer())
      .get(
        '/cakes?latitude=37.5&longitude=127.1&dist=3000&after=cursor-0&count=1',
      )
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(200);

    expect(response.body).toEqual(fixtures.cakesByCursor);
    expect(catalogQuery.findAllCakes).toHaveBeenCalledWith(
      expect.objectContaining({
        firebaseUid: 'user-1',
        roles: [Roles.BUYER],
      }),
      37.5,
      127.1,
      3000,
      'cursor-0',
      1,
    );
  });

  it('keeps GET /cakes/location query conversion and response fixture', async () => {
    const response = await request(app.getHttpServer())
      .get(
        '/cakes/location?latitude=37.6&longitude=127.2&dist=2500&after=65a000000000000000000000&count=2',
      )
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(200);

    expect(response.body).toEqual(fixtures.cakesByLocation);
    expect(catalogQuery.findAllCakesByLocation).toHaveBeenCalledWith(
      expect.objectContaining({ firebaseUid: 'user-1' }),
      37.6,
      127.2,
      2500,
      '65a000000000000000000000',
      2,
    );
  });

  it('keeps GET /stores query conversion and response fixture', async () => {
    const response = await request(app.getHttpServer())
      .get('/stores?latitude=37.7&longitude=127.3&dist=1500&after=10.5&count=3')
      .set('Authorization', 'Bearer seller:seller-1')
      .expect(200);

    expect(response.body).toEqual(fixtures.stores);
    expect(catalogQuery.findAllStores).toHaveBeenCalledWith(
      expect.objectContaining({
        firebaseUid: 'seller-1',
        roles: [Roles.SELLER],
      }),
      37.7,
      127.3,
      1500,
      10.5,
      3,
    );
  });

  it('keeps GET /stores/:id/cakes query conversion and response fixture', async () => {
    const response = await request(app.getHttpServer())
      .get('/stores/store-1/cakes?after=after-cake-id&count=4')
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(200);

    expect(response.body).toEqual(fixtures.storeCakes);
    expect(catalogQuery.findStoreCakes).toHaveBeenCalledWith(
      'store-1',
      expect.objectContaining({ firebaseUid: 'user-1' }),
      'after-cake-id',
      4,
    );
  });

  it('keeps GET /cakes/:id/similar query conversion and response fixture', async () => {
    const response = await request(app.getHttpServer())
      .get(
        '/cakes/cake-1/similar?latitude=37.8&longitude=127.4&dist=5000&size=6',
      )
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(200);

    expect(response.body).toEqual(fixtures.similarCakes);
    expect(similarCakeQuery.execute).toHaveBeenCalledWith(
      'cake-1',
      127.4,
      37.8,
      5000,
      6,
    );
  });

  it('keeps GET /users/:id/liked-cakes self contract and fixture', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/user-1/liked-cakes')
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(200);

    expect(response.body).toEqual(fixtures.likedCakes);
    expect(likeService.findUserLikeCake).toHaveBeenCalledWith('user-1');
  });

  it('keeps GET /users/:id/liked-stores admin contract and fixture', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/user-1/liked-stores')
      .set('Authorization', 'Bearer admin:admin-1')
      .expect(200);

    expect(response.body).toEqual(fixtures.likedStores);
    expect(likeService.findUserLikeStore).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        firebaseUid: 'admin-1',
        roles: [Roles.ADMIN],
      }),
    );
  });

  it('rejects a seller and another buyer from liked-store reads', async () => {
    await request(app.getHttpServer())
      .get('/users/user-1/liked-stores')
      .set('Authorization', 'Bearer seller:seller-1')
      .expect(403);

    await request(app.getHttpServer())
      .get('/users/user-1/liked-stores')
      .set('Authorization', 'Bearer buyer:user-2')
      .expect(403);

    expect(likeService.findUserLikeStore).not.toHaveBeenCalled();
  });

  it('freezes malformed numeric query conversion as NaN', async () => {
    await request(app.getHttpServer())
      .get(
        '/cakes?latitude=not-a-number&longitude=bad&dist=invalid&after=&count=nope',
      )
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(200);

    const call = catalogQuery.findAllCakes.mock.calls[0];
    expect(Number.isNaN(call[1])).toBe(true);
    expect(Number.isNaN(call[2])).toBe(true);
    expect(Number.isNaN(call[3])).toBe(true);
    expect(call[4]).toBe('');
    expect(Number.isNaN(call[5])).toBe(true);
  });

  it('keeps empty catalog and like response shapes', async () => {
    catalogQuery.findAllStores.mockResolvedValueOnce(fixtures.emptyStoresPage);
    similarCakeQuery.execute.mockResolvedValueOnce(fixtures.emptyPage);
    likeService.findUserLikeStore.mockResolvedValueOnce(fixtures.emptyList);

    const stores = await request(app.getHttpServer())
      .get('/stores?latitude=37.5&longitude=127.1&count=20')
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(200);
    const similar = await request(app.getHttpServer())
      .get('/cakes/cake-1/similar?latitude=37.5&longitude=127.1&size=6')
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(200);
    const likedStores = await request(app.getHttpServer())
      .get('/users/user-1/liked-stores')
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(200);

    expect(stores.body).toEqual(fixtures.emptyStoresPage);
    expect(similar.body).toEqual(fixtures.emptyPage);
    expect(likedStores.body).toEqual(fixtures.emptyList);
  });

  it('freezes POST /stores created Store response shape', async () => {
    const requestBody = {
      name: 'Created Store',
      location: { type: 'Point', coordinates: [127.1, 37.5] },
      address: 'Seoul',
      owner_user_id: 'seller-1',
      operating_time: ['10:00-18:00'],
      taste: ['vanilla'],
    };

    const response = await request(app.getHttpServer())
      .post('/stores')
      .set('Authorization', 'Bearer admin:admin-1')
      .send(requestBody)
      .expect(201);

    expect(response.body).toEqual(fixtures.createdStore);
    expect(storeService.create).toHaveBeenCalledWith(requestBody);
  });
});
