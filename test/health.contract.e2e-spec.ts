import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import appConfig from 'src/config/app.config';
import { HealthController } from 'src/health/health.controller';
import { HealthService } from 'src/health/health.service';
import { ReadinessState } from 'src/health/readiness-state';
import { HomeCachePort } from 'src/home/application/port/home-cache.port';

describe('Health HTTP contract (e2e)', () => {
  let app: INestApplication;
  let readiness: ReadinessState;
  let mongoReadyState = 1;
  let redisStatus: 'up' | 'down' | 'disabled' = 'disabled';

  beforeEach(async () => {
    mongoReadyState = 1;
    redisStatus = 'disabled';
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        ReadinessState,
        {
          provide: appConfig.KEY,
          useValue: { nodeEnv: 'test', port: 3000, shutdownDrainMs: 0 },
        },
        {
          provide: getConnectionToken('kezzle'),
          useValue: {
            get readyState() {
              return mongoReadyState;
            },
          },
        },
        {
          provide: HomeCachePort,
          useValue: {
            healthStatus: () => redisStatus,
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    readiness = module.get(ReadinessState);
  });

  afterEach(async () => {
    await app.close();
  });

  it('keeps liveness 200 regardless of lifecycle and dependency failures', async () => {
    mongoReadyState = 0;
    redisStatus = 'down';

    await request(app.getHttpServer())
      .get('/health/live')
      .expect('Cache-Control', 'no-store')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('returns 503 before the application accepts traffic', async () => {
    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503)
      .expect({
        status: 'unavailable',
        checks: {
          lifecycle: 'booting',
          mongo: 'up',
          redis: 'disabled',
        },
      });
  });

  it('reports optional Redis failure as degraded without failing readiness', async () => {
    readiness.markReady();
    redisStatus = 'down';

    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200)
      .expect({
        status: 'degraded',
        checks: {
          lifecycle: 'ready',
          mongo: 'up',
          redis: 'down',
        },
      });
  });

  it('returns 503 when required Mongo disconnects', async () => {
    readiness.markReady();
    mongoReadyState = 0;

    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503)
      .expect({
        status: 'unavailable',
        checks: {
          lifecycle: 'ready',
          mongo: 'down',
          redis: 'disabled',
        },
      });
  });

  it('returns 503 as soon as shutdown begins', async () => {
    readiness.markReady();
    readiness.beginShutdown();

    await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503)
      .expect({
        status: 'unavailable',
        checks: {
          lifecycle: 'shutting-down',
          mongo: 'up',
          redis: 'disabled',
        },
      });
  });
});
