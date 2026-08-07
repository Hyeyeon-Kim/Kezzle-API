import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AnniversaryService } from 'src/modules/anniversary/application/query/anniversary.service';
import { CakeQueryService } from 'src/modules/cake/application/query/cake-query.service';
import homeConfig from 'src/platform/config/home.config';
import { CurationQueryService } from 'src/modules/curation/application/query/curation-query.service';
import { HomeCachePort } from 'src/modules/home/application/port/home-cache.port';
import { HomeMetrics } from 'src/modules/home/application/port/home-metrics.port';
import { HomePresenter } from 'src/modules/home/api/home.presenter';
import { HomeController } from 'src/modules/home/api/home.controller';
import { HomeFeedService } from 'src/modules/home/application/home-feed.service';
import { HomeSectionLoader } from 'src/modules/home/application/home-section.loader';
import { RankingQueryService } from 'src/modules/ranking/application/query/ranking-query.service';
import { homeConfigFixture } from './support/typed-config.fixtures';

describe('Home hard deadline HTTP contract (e2e)', () => {
  let app: INestApplication;
  let recommendSignal: AbortSignal | undefined;

  beforeAll(async () => {
    const cakeService = {
      findRecommendationSeed: jest.fn().mockResolvedValue('seed-cake'),
      findAllByRecommend: jest.fn((_seed: string, signal: AbortSignal) => {
        recommendSignal = signal;
        return new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            reject(new Error('mock VIT request aborted'));
          });
        });
      }),
      findAllByNewest: jest
        .fn()
        .mockResolvedValue({ cakes: [], hasMore: false }),
    };
    const anniversaryService = {
      findNextAnniversary: jest.fn().mockResolvedValue({
        id: 'anniversary-1',
        name: '기념일',
        keyword: ['기념일'],
        date: new Date(),
        mention: '기념일 케이크',
      }),
      getAnniversaryRecommendations: jest.fn().mockResolvedValue({
        id: 'anniversary-1',
        name: '기념일',
        dday: 'D-1',
        mention: '기념일 케이크',
        images: [],
      }),
    };
    const rankingQuery = {
      getPopularCakes: jest.fn().mockResolvedValue({
        cakes: [],
        startDate: '2026-07-01',
        endDate: '2026-08-01',
      }),
      getKeywordRank: jest.fn().mockResolvedValue({
        ranking: [],
        startDate: '2026-07-01',
        endDate: '2026-08-01',
      }),
      getPopularFallback: jest.fn().mockReturnValue({
        cakes: [],
        startDate: '2026-07-01',
        endDate: '2026-08-01',
      }),
      getKeywordFallback: jest.fn().mockReturnValue({
        ranking: [],
        startDate: '2026-07-01',
        endDate: '2026-08-01',
      }),
    };
    const curationQuery = {
      findFeatured: jest.fn().mockResolvedValue([]),
    };
    const homeMetrics = {
      run: jest.fn((callback: () => Promise<unknown>) => callback()),
      timeSection: jest.fn((_name: string, callback: () => Promise<unknown>) =>
        callback(),
      ),
      observeRequest: jest.fn(),
      observeSection: jest.fn(),
      countDegraded: jest.fn(),
      countDb: jest.fn(),
      countAi: jest.fn(),
      countAiError: jest.fn(),
      countBackgroundRefresh: jest.fn(),
      countCache: jest.fn(),
      flush: jest.fn(),
    };
    const homeCache = {
      getWithSwr: jest.fn(({ refresh }) => refresh()),
    };
    const module = await Test.createTestingModule({
      controllers: [HomeController],
      providers: [
        HomeFeedService,
        HomeSectionLoader,
        HomePresenter,
        { provide: CakeQueryService, useValue: cakeService },
        { provide: AnniversaryService, useValue: anniversaryService },
        { provide: RankingQueryService, useValue: rankingQuery },
        { provide: CurationQueryService, useValue: curationQuery },
        { provide: HomeMetrics, useValue: homeMetrics },
        { provide: HomeCachePort, useValue: homeCache },
        {
          provide: homeConfig.KEY,
          useValue: {
            ...homeConfigFixture,
            hardDeadlineMs: 40,
            sectionTimeoutMs: {
              ...homeConfigFixture.sectionTimeoutMs,
              recommendCakes: 5000,
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns the degraded timeout fallback and aborts unfinished AI work', async () => {
    const startedAt = Date.now();
    await request(app.getHttpServer())
      .get('/curation')
      .expect(200)
      .expect(({ body }) => {
        expect(body.degraded).toBe(true);
        expect(body.recommendCakes).toEqual([]);
        expect(body.sections.recommendCakes).toMatchObject({
          status: 'fallback',
          reason: 'timeout',
        });
        expect(body.sections.popularCakes.status).toBe('success');
        expect(body.sections.newestCakes.status).toBe('success');
      });

    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(recommendSignal?.aborted).toBe(true);
  });
});
