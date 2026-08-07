import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import appConfig from 'src/platform/config/app.config';
import { HealthController } from 'src/platform/health/health.controller';
import { HealthService } from 'src/platform/health/health.service';
import { ReadinessState } from 'src/platform/health/readiness-state';
import { DependencyHealthRegistry } from 'src/platform/health/dependency-health.registry';

describe('Health HTTP contract (e2e)', () => {
  let app: INestApplication;
  let readiness: ReadinessState;
  let mongoReadyState = 1;
  let redisStatus: 'up' | 'down' | 'disabled' = 'disabled';

  beforeEach(async () => {
    app = undefined;
    mongoReadyState = 1;
    redisStatus = 'disabled';
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        ReadinessState,
        DependencyHealthRegistry,
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
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    readiness = module.get(ReadinessState);
    module.get(DependencyHealthRegistry).register('redis', () => redisStatus);
  });

  afterEach(async () => {
    await app?.close();
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
