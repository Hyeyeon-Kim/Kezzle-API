import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AnniversaryService } from 'src/anniversary/anniversary.service';
import { CakeService } from 'src/cake/cake.service';
import homeConfig from 'src/config/home.config';
import { CurationQueryService } from 'src/curation/curation-query.service';
import { HomeCacheService } from 'src/home-cache/home-cache.service';
import { HomeMetrics } from 'src/home/application/home-metrics.port';
import { HomePresenter } from 'src/home/api/home.presenter';
import { HomeController } from 'src/home/home.controller';
import { HomeFeedService } from 'src/home/home-feed.service';
import { RankingQueryService } from 'src/ranking/ranking-query.service';
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
        HomePresenter,
        { provide: CakeService, useValue: cakeService },
        { provide: AnniversaryService, useValue: anniversaryService },
        { provide: RankingQueryService, useValue: rankingQuery },
        { provide: CurationQueryService, useValue: curationQuery },
        { provide: HomeMetrics, useValue: homeMetrics },
        { provide: HomeCacheService, useValue: homeCache },
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

  afterAll(async () => app.close());

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
