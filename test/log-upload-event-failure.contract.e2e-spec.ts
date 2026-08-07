import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ClipSearchPort } from 'src/integrations/ai-search/application/clip-search.port';
import { RolesGuard } from 'src/platform/auth/guard/roles.guard';
import { CakeLikePort } from 'src/modules/cake/application/port/cake-like.port';
import { LikedStoreCatalogReader } from 'src/modules/catalog/application/port/liked-store-catalog.reader';
import { LikePresenter } from 'src/modules/like/api/like.presenter';
import { LikeController } from 'src/modules/like/api/like.controller';
import { LikeService } from 'src/modules/like/application/like.service';
import { CakeLikeEventRecorder } from 'src/modules/like/application/port/cake-like-event-recorder.port';
import { CakeLikeEventMetrics } from 'src/modules/like/application/port/cake-like-event-metrics.port';
import { SearchEventRecorder } from 'src/modules/search/application/port/search-event-recorder.port';
import { SearchEventMetrics } from 'src/modules/search/application/port/search-event-metrics.port';
import { SearchHistoryReader } from 'src/modules/search/application/port/search-history.reader';
import { SearchController } from 'src/modules/search/api/search.controller';
import { SearchService } from 'src/modules/search/application/search.service';
import { StoreLikePort } from 'src/modules/store/application/port/store-like.port';
import { Roles } from 'src/platform/auth/roles.enum';
import { UserLikePort } from 'src/modules/user/application/port/user-like.port';

@Injectable()
class EventFailureContractGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest().user = {
      firebaseUid: 'buyer-1',
      nickname: 'buyer',
      oauthProvider: 'contract',
      roles: [Roles.BUYER],
      cakeLikeIds: [],
      storeLikeIds: [],
    };
    return true;
  }
}

function observedEventFailure(): Promise<never> {
  const failure = Promise.reject(new Error('event create failed'));
  void failure.catch(() => undefined);
  return failure;
}

describe('Log event create failure HTTP contract', () => {
  let app: INestApplication;

  const cakeLikeEventRecorder = {
    record: jest.fn().mockImplementation(observedEventFailure),
  };
  const searchEventRecorder = {
    record: jest.fn().mockImplementation(observedEventFailure),
  };
  const searchEventMetrics = {
    countRecordFailure: jest.fn(),
  };
  const cakeLikeEventMetrics = {
    countRecordFailure: jest.fn(),
  };
  const cakeLikePort = {
    findTargetOrThrow: jest.fn().mockResolvedValue({ likedUserIds: [] }),
    addUserLike: jest.fn().mockResolvedValue(undefined),
    removeUserLike: jest.fn().mockResolvedValue(undefined),
  };
  const userLikePort = {
    addCakeLike: jest.fn().mockResolvedValue(undefined),
    removeCakeLike: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SearchController, LikeController],
      providers: [
        SearchService,
        LikeService,
        LikePresenter,
        {
          provide: ClipSearchPort,
          useValue: {
            koSearchPage: jest.fn().mockResolvedValue({
              result: [],
              nextPage: 1,
              isLastPage: true,
            }),
          },
        },
        { provide: CakeLikeEventRecorder, useValue: cakeLikeEventRecorder },
        { provide: SearchEventRecorder, useValue: searchEventRecorder },
        { provide: SearchHistoryReader, useValue: {} },
        { provide: SearchEventMetrics, useValue: searchEventMetrics },
        {
          provide: CakeLikeEventMetrics,
          useValue: cakeLikeEventMetrics,
        },
        { provide: CakeLikePort, useValue: cakeLikePort },
        { provide: UserLikePort, useValue: userLikePort },
        { provide: StoreLikePort, useValue: {} },
        { provide: LikedStoreCatalogReader, useValue: {} },
        { provide: APP_GUARD, useClass: EventFailureContractGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps GET /search HTTP 200 when search event create fails', async () => {
    await request(app.getHttpServer())
      .get('/search')
      .query({ keyword: 'birthday', page: 0 })
      .expect(200);

    expect(searchEventRecorder.record).toHaveBeenCalledWith(
      'buyer-1',
      'birthday',
      [],
    );
    expect(searchEventMetrics.countRecordFailure).toHaveBeenCalledTimes(1);
  });

  it('keeps Cake like add/remove HTTP success when event create fails', async () => {
    await request(app.getHttpServer())
      .post('/cakes/cake-1/likes')
      .expect(201, 'true');
    await request(app.getHttpServer())
      .delete('/cakes/cake-1/likes')
      .expect(200, 'true');

    expect(cakeLikeEventRecorder.record.mock.calls).toEqual([
      ['buyer-1', 'cake-1', true],
      ['buyer-1', 'cake-1', false],
    ]);
    expect(cakeLikeEventMetrics.countRecordFailure).toHaveBeenCalledTimes(2);
  });
});
