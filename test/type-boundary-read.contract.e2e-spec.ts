import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { IS_PUBLIC_KEY } from 'src/auth/decorators/public.decorator';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { CakeController } from 'src/cake/cake.controller';
import { CakeService } from 'src/cake/cake.service';
import { CurationController } from 'src/curation/curation.controller';
import { CurationService } from 'src/curation/curation.service';
import { HomeFeedService } from 'src/home/home-feed.service';
import { HomeController } from 'src/home/home.controller';
import { SearchController } from 'src/search/search.controller';
import { SearchService } from 'src/search/search.service';
import { StoreController } from 'src/store/store.controller';
import { StoreService } from 'src/store/store.service';
import { Roles } from 'src/user/entities/roles.enum';
import { UserController } from 'src/user/user.controller';
import { UserService } from 'src/user/user.service';
import fixtures from './fixtures/type-boundary-read.contract.json';

@Injectable()
class TypeBoundaryAuthenticationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

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
      cakeLikeIds: firebaseUid === 'user-1' ? ['cake-detail-1'] : [],
      storeLikeIds: [],
    };
    return true;
  }
}

describe('Type-A read HTTP contract baseline', () => {
  let app: INestApplication;

  const cakeService = {
    findAllByNewest: jest.fn(),
    popular: jest.fn(),
    anniversary: jest.fn(),
    findOne: jest.fn(),
  };
  const storeService = { findOne: jest.fn() };
  const userService = {
    findAll: jest.fn(),
    findOneByFirebase: jest.fn(),
  };
  const searchService = {
    search: jest.fn(),
    getRank: jest.fn(),
    getLatest: jest.fn(),
  };
  const curationService = { showCuration: jest.fn() };
  const homeFeedService = { getHome: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        CakeController,
        StoreController,
        UserController,
        SearchController,
        CurationController,
        HomeController,
      ],
      providers: [
        { provide: CakeService, useValue: cakeService },
        { provide: StoreService, useValue: storeService },
        { provide: UserService, useValue: userService },
        { provide: SearchService, useValue: searchService },
        { provide: CurationService, useValue: curationService },
        { provide: HomeFeedService, useValue: homeFeedService },
        {
          provide: APP_GUARD,
          useClass: TypeBoundaryAuthenticationGuard,
        },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    cakeService.findAllByNewest.mockResolvedValue(fixtures.newestCakes);
    cakeService.popular.mockResolvedValue(fixtures.popularCakes);
    cakeService.anniversary.mockResolvedValue(fixtures.anniversaryCakes);
    cakeService.findOne.mockResolvedValue(fixtures.cakeDetail);
    storeService.findOne.mockResolvedValue(fixtures.storeDetail);
    userService.findAll.mockResolvedValue(fixtures.users);
    userService.findOneByFirebase.mockResolvedValue(fixtures.userDetail);
    searchService.search.mockResolvedValue(fixtures.searchResult);
    searchService.getRank.mockResolvedValue(fixtures.searchRank);
    searchService.getLatest.mockResolvedValue(fixtures.latestSearch);
    curationService.showCuration.mockResolvedValue(fixtures.curationDetail);
    homeFeedService.getHome.mockResolvedValue(fixtures.home);
  });

  afterAll(async () => {
    await app.close();
  });

  const protectedRoutes = [
    '/cakes/newest?after=newest-cursor&count=2',
    '/cakes/popular?after=12.5&limit=3',
    '/cakes/anniversary/anniversary-1?page=2',
    '/cakes/cake-detail-1',
    '/stores/store-detail-1',
    '/users',
    '/users/user-1',
    '/search?keyword=lettering&page=0',
    '/search/user-1',
    '/curation',
  ];

  it.each(protectedRoutes)('rejects anonymous GET %s', async (path) => {
    await request(app.getHttpServer()).get(path).expect(401);
  });

  it('keeps newest Cake pagination, Image keys, and empty hashtag', async () => {
    const response = await request(app.getHttpServer())
      .get('/cakes/newest?after=newest-cursor&count=2')
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(200);

    expect(response.body).toEqual(fixtures.newestCakes);
    expect(cakeService.findAllByNewest).toHaveBeenCalledWith(
      'newest-cursor',
      2,
    );
    expect(response.body.cakes[0].image).toHaveProperty('converte_name');
    expect(response.body.cakes[0].hashtag).toEqual([]);
  });

  it('keeps popular Cake numeric conversion and date window', async () => {
    const response = await request(app.getHttpServer())
      .get('/cakes/popular?after=12.5&limit=3')
      .set('Authorization', 'Bearer seller:seller-1')
      .expect(200);

    expect(response.body).toEqual(fixtures.popularCakes);
    expect(cakeService.popular).toHaveBeenCalledWith(12.5, 3);
  });

  it('keeps anniversary viewer context, page conversion, and isLiked', async () => {
    const response = await request(app.getHttpServer())
      .get('/cakes/anniversary/anniversary-1?page=2')
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(200);

    expect(response.body).toEqual(fixtures.anniversaryCakes);
    expect(response.body.cakes[0].isLiked).toBe(true);
    expect(cakeService.anniversary).toHaveBeenCalledWith('anniversary-1', 2);
  });

  it('keeps Cake detail viewer-specific response', async () => {
    const response = await request(app.getHttpServer())
      .get('/cakes/cake-detail-1')
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(200);

    expect(response.body).toEqual(fixtures.cakeDetail);
    expect(response.body.isLiked).toBe(true);
    expect(cakeService.findOne).toHaveBeenCalledWith('cake-detail-1');
  });

  it('keeps Store detail null logo and empty detail image boundaries', async () => {
    const response = await request(app.getHttpServer())
      .get('/stores/store-detail-1')
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(200);

    expect(response.body).toEqual(fixtures.storeDetail);
    expect(response.body.logo).toBeNull();
    expect(response.body.detail_images).toEqual([]);
    expect(response.body).toHaveProperty('kakako_url');
    expect(storeService.findOne).toHaveBeenCalledWith('store-detail-1');
  });

  it('keeps admin-only User list and roles arrays', async () => {
    const response = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', 'Bearer admin:admin-1')
      .expect(200);

    expect(response.body).toEqual(fixtures.users);
    expect(response.body.every((user) => Array.isArray(user.roles))).toBe(true);
    expect(userService.findAll).toHaveBeenCalledWith();

    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(403);
  });

  it('keeps self-owned User detail and current-user roles arrays', async () => {
    const response = await request(app.getHttpServer())
      .get('/users/user-1')
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(200);

    expect(response.body).toEqual(fixtures.userDetail);
    expect(response.body.roles).toEqual([Roles.BUYER]);
    expect(userService.findOneByFirebase).toHaveBeenCalledWith('user-1');

    await request(app.getHttpServer())
      .get('/users/user-1')
      .set('Authorization', 'Bearer buyer:user-2')
      .expect(403);
  });

  it('keeps Search pagination, viewer context, and isLiked false', async () => {
    const response = await request(app.getHttpServer())
      .get('/search')
      .query({ keyword: 'lettering, birthday', page: '0' })
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(200);

    expect(response.body).toEqual(fixtures.searchResult);
    expect(response.body.cakes[0].isLiked).toBe(false);
    expect(searchService.search).toHaveBeenCalledWith(
      'lettering, birthday',
      0,
      'user-1',
    );
  });

  it('keeps public Search rank dates and response keys', async () => {
    const response = await request(app.getHttpServer())
      .get('/search/rank?startDate=2026-07-01&endDate=2026-07-20')
      .expect(200);

    expect(response.body).toEqual(fixtures.searchRank);
    expect(searchService.getRank).toHaveBeenCalledWith(
      '2026-07-01',
      '2026-07-20',
    );
  });

  it('keeps self-owned latest Search empty array shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/search/user-1')
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(200);

    expect(response.body).toEqual(fixtures.latestSearch);
    expect(response.body.keywords).toEqual([]);
    expect(searchService.getLatest).toHaveBeenCalledWith('user-1');
  });

  it('keeps public Curation detail page conversion and nested cake shape', async () => {
    const response = await request(app.getHttpServer())
      .get('/curation/curation-1?page=3')
      .expect(200);

    expect(response.body).toEqual(fixtures.curationDetail);
    expect(response.body.cakes[0].image).toHaveProperty('converte_name');
    expect(curationService.showCuration).toHaveBeenCalledWith('curation-1', 3);
  });

  it('keeps protected Home response, section metadata, and roles array', async () => {
    const response = await request(app.getHttpServer())
      .get('/curation')
      .set('Authorization', 'Bearer buyer:user-1')
      .expect(200);

    expect(response.body).toEqual(fixtures.home);
    expect(response.body.degraded).toBe(false);
    expect(homeFeedService.getHome).toHaveBeenCalledWith(
      expect.objectContaining({
        firebaseUid: 'user-1',
        roles: [Roles.BUYER],
      }),
    );
  });
});
