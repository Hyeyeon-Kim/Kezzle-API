import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ClipClient } from 'src/ai-search/clip-client';
import { RolesGuard } from 'src/auth/guard/roles.guard';
import { CakeLikePort } from 'src/cake/application/port/cake-like.port';
import { LikedStoreCatalogReader } from 'src/catalog/application/port/liked-store-catalog.reader';
import { LikePresenter } from 'src/like/api/like.presenter';
import { LikeController } from 'src/like/api/like.controller';
import { LikeService } from 'src/like/application/like.service';
import { CakeLikeEventRecorder } from 'src/like/application/port/cake-like-event-recorder.port';
import { CakeLikeEventMetricsAdapter } from 'src/like/infrastructure/observability/cake-like-event-metrics.adapter';
import { SearchEventRecorder } from 'src/search/application/port/search-event-recorder.port';
import { SearchHistoryReader } from 'src/search/application/port/search-history.reader';
import { SearchController } from 'src/search/api/search.controller';
import { SearchService } from 'src/search/application/search.service';
import { SearchEventMetricsAdapter } from 'src/search/infrastructure/observability/search-event-metrics.adapter';
import { StoreLikePort } from 'src/store/application/port/store-like.port';
import { Roles } from 'src/user/domain/roles.enum';
import { UserLikePort } from 'src/user/application/port/user-like.port';

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
          provide: ClipClient,
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
        { provide: SearchEventMetricsAdapter, useValue: searchEventMetrics },
        {
          provide: CakeLikeEventMetricsAdapter,
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
