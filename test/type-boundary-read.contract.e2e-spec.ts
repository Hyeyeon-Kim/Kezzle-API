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
import { IS_PUBLIC_KEY } from 'src/platform/auth/decorators/public.decorator';
import { RolesGuard } from 'src/platform/auth/guard/roles.guard';
import { CakeController } from 'src/modules/cake/api/cake.controller';
import { CakeQueryService } from 'src/modules/cake/application/query/cake-query.service';
import { CakeMediaService } from 'src/modules/cake/application/media/cake-media.service';
import { CakeImportService } from 'src/modules/cake/application/import/cake-import.service';
import { CurationController } from 'src/modules/curation/api/curation.controller';
import { CurationService } from 'src/modules/curation/application/curation.service';
import { HomeFeedService } from 'src/modules/home/application/home-feed.service';
import { HomeController } from 'src/modules/home/api/home.controller';
import { HomePresenter } from 'src/modules/home/api/home.presenter';
import { RankingController } from 'src/modules/ranking/api/ranking.controller';
import { RankingQueryService } from 'src/modules/ranking/application/query/ranking-query.service';
import { SearchController } from 'src/modules/search/api/search.controller';
import { SearchService } from 'src/modules/search/application/search.service';
import { StoreController } from 'src/modules/store/api/store.controller';
import { StoreService } from 'src/modules/store/application/store.service';
import { StoreMediaService } from 'src/modules/store/application/media/store-media.service';
import { Roles } from 'src/platform/auth/roles.enum';
import { UserController } from 'src/modules/user/api/user.controller';
import { UserService } from 'src/modules/user/application/user.service';
import fixtures from './fixtures/type-boundary-read.contract.json';

const imageValue = (image) => ({
  name: image.name,
  converteName: image.converte_name,
  key: image.key,
  s3Url: image.s3Url,
});

const cakeView = (cake, likedUserId = 'user-1') => ({
  id: cake._id,
  image: imageValue(cake.image),
  ownerStoreId: cake.owner_store_id,
  likedUserIds: cake.isLiked ? [likedUserId] : [],
  cursor: cake.cursor,
  tags: [...(cake.hashtag ?? [])],
  calculatedLikes: cake.popular_cal,
  isDeleted: false,
});

const userView = (user) => ({
  firebaseUid: user.firebaseUid,
  nickname: user.nickname,
  oauthProvider: 'password',
  roles: user.roles,
  cakeLikeIds: [...user.cake_like_ids],
  storeLikeIds: [],
});

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
    getLatest: jest.fn(),
  };
  const rankingQuery = {
    getPopularCakes: jest.fn(),
    getKeywordRank: jest.fn(),
  };
  const curationService = { showCuration: jest.fn() };
  const homeFeedService = { getHome: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        RankingController,
        CakeController,
        StoreController,
        UserController,
        SearchController,
        CurationController,
        HomeController,
      ],
      providers: [
        { provide: CakeQueryService, useValue: cakeService },
        { provide: CakeMediaService, useValue: {} },
        { provide: CakeImportService, useValue: {} },
        { provide: StoreService, useValue: storeService },
        { provide: StoreMediaService, useValue: {} },
        { provide: UserService, useValue: userService },
        { provide: SearchService, useValue: searchService },
        { provide: RankingQueryService, useValue: rankingQuery },
        { provide: CurationService, useValue: curationService },
        { provide: HomeFeedService, useValue: homeFeedService },
        HomePresenter,
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
    cakeService.findAllByNewest.mockResolvedValue({
      hasMore: fixtures.newestCakes.hasMore,
      cakes: fixtures.newestCakes.cakes.map((cake) => cakeView(cake)),
    });
    rankingQuery.getPopularCakes.mockResolvedValue({
      startDate: fixtures.popularCakes.startDate,
      endDate: fixtures.popularCakes.endDate,
      cakes: fixtures.popularCakes.cakes.map((cake) => cakeView(cake)),
    });
    cakeService.anniversary.mockResolvedValue({
      hasMore: fixtures.anniversaryCakes.hasMore,
      cakes: fixtures.anniversaryCakes.cakes.map((cake) => cakeView(cake)),
    });
    cakeService.findOne.mockResolvedValue(cakeView(fixtures.cakeDetail));
    storeService.findOne.mockResolvedValue({
      id: fixtures.storeDetail._id,
      name: fixtures.storeDetail.name,
      logo: fixtures.storeDetail.logo,
      feature: fixtures.storeDetail.store_feature,
      description: fixtures.storeDetail.store_description,
      instagramUrl: fixtures.storeDetail.insta_url,
      kakaoChannelUrl: fixtures.storeDetail.kakako_url,
      kakaoMapUrl: fixtures.storeDetail.kakao_map_url,
      location: {
        latitude: fixtures.storeDetail.latitude,
        longitude: fixtures.storeDetail.longitude,
      },
      address: fixtures.storeDetail.address,
      phoneNumber: fixtures.storeDetail.phone_number,
      ownerUserId: 'seller-1',
      detailImages: [],
      operatingTime: fixtures.storeDetail.operating_time,
      likedUserIds: [],
      taste: fixtures.storeDetail.taste,
      distance: fixtures.storeDetail.distance,
    });
    userService.findAll.mockResolvedValue(fixtures.users.map(userView));
    userService.findOneByFirebase.mockResolvedValue(
      userView(fixtures.userDetail),
    );
    searchService.search.mockResolvedValue({
      hasMore: fixtures.searchResult.hasMore,
      nextPage: fixtures.searchResult.nextPage,
      cakes: fixtures.searchResult.cakes.map((cake) => cakeView(cake)),
    });
    rankingQuery.getKeywordRank.mockResolvedValue({
      ...fixtures.searchRank,
      ranking: fixtures.searchRank.ranking.map((rank) => ({
        id: rank._id,
        count: rank.count,
      })),
    });
    searchService.getLatest.mockResolvedValue(fixtures.latestSearch);
    curationService.showCuration.mockResolvedValue({
      description: fixtures.curationDetail.description,
      cakes: fixtures.curationDetail.cakes.map((cake) => cakeView(cake)),
    });
    homeFeedService.getHome.mockResolvedValue({
      anniversary: {
        id: fixtures.home.anniversary._id,
        name: fixtures.home.anniversary.name,
        dday: fixtures.home.anniversary.dday,
        mention: fixtures.home.anniversary.ment,
        images: fixtures.home.anniversary.images,
      },
      recommendCakes: fixtures.home.recommendCakes.map((cake) =>
        cakeView(cake),
      ),
      popularCakes: fixtures.home.popularCakes,
      keywordRanks: fixtures.home.keywordRanks,
      newestCakes: fixtures.home.newestCakes,
      curations: fixtures.home.curations.map((curation) => ({
        id: curation._id,
        cakes: [],
        key: curation.description,
      })),
      degraded: fixtures.home.degraded,
      sections: fixtures.home.sections,
    });
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
    expect(rankingQuery.getPopularCakes).toHaveBeenCalledWith(12.5, 3);
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
    expect(rankingQuery.getKeywordRank).toHaveBeenCalledWith(
      '2026-07-01',
      '2026-07-20',
    );
    expect(searchService.getLatest).not.toHaveBeenCalledWith('rank');
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
