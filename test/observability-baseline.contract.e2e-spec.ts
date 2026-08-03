import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { IS_PUBLIC_KEY } from 'src/auth/decorators/public.decorator';
import { MetricsService } from 'src/metrics/metrics.service';
import { MonitoringController } from 'src/monitoring/monitoring.controller';
import { MonitoringService } from 'src/monitoring/monitoring.service';
import observabilityBaseline from './fixtures/observability-baseline.contract.json';

@Injectable()
class PublicMetadataOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}

describe('Observability Phase A HTTP contract', () => {
  let app: INestApplication;
  let metricsService: MetricsService;
  let monitoringService: MonitoringService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MonitoringController],
      providers: [
        MetricsService,
        MonitoringService,
        { provide: APP_GUARD, useClass: PublicMetadataOnlyGuard },
      ],
    }).compile();

    metricsService = moduleRef.get(MetricsService);
    monitoringService = moduleRef.get(MonitoringService);
    seedAllCustomMetrics(metricsService, monitoringService);

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the public GET /metrics contract without credentials', async () => {
    const response = await request(app.getHttpServer())
      .get(observabilityBaseline.http.path)
      .expect(observabilityBaseline.http.status);

    expect(response.headers['cache-control']).toBe(
      observabilityBaseline.http.cacheControl,
    );
    expect(response.headers['content-type']).toContain(
      observabilityBaseline.http.contentTypeIncludes,
    );
  });

  it('concatenates both current registries and exposes every custom metric contract', async () => {
    const response = await request(app.getHttpServer())
      .get(observabilityBaseline.http.path)
      .expect(200);

    const customMetrics = [
      ...observabilityBaseline.registries.metricsService.customMetrics,
      ...observabilityBaseline.registries.monitoringService.customMetrics,
    ];
    for (const metric of customMetrics) {
      expect(response.text).toContain(`# HELP ${metric.name} ${metric.help}`);
      expect(response.text).toContain(`# TYPE ${metric.name} ${metric.type}`);
    }
  });

  it('characterizes duplicate unprefixed and kezzle-prefixed default metrics', async () => {
    const response = await request(app.getHttpServer())
      .get(observabilityBaseline.http.path)
      .expect(200);

    const unprefixed =
      observabilityBaseline.registries.metricsService.defaultMetricFamilies;
    const prefixed =
      observabilityBaseline.registries.monitoringService.defaultMetricFamilies;

    expect(prefixed).toEqual(unprefixed.map((name) => `kezzle_${name}`));
    for (const metricName of [...unprefixed, ...prefixed]) {
      expect(response.text).toContain(`# HELP ${metricName} `);
      expect(response.text).toContain(`# TYPE ${metricName} `);
    }
  });
});

function seedAllCustomMetrics(
  metrics: MetricsService,
  monitoring: MonitoringService,
): void {
  metrics.similarSearchDuration.observe({ status: 'success' }, 0.1);
  metrics.aiApiCallDuration.observe(
    { status: 'success', model: 'vit', endpoint: '/similar' },
    0.2,
  );
  metrics.storeQueryDuration.observe(0.01);
  metrics.aiApiErrors.inc({
    reason: 'timeout',
    model: 'clip',
    endpoint: '/search',
  });
  metrics.searchEventRecordFailures.inc();
  metrics.cakeLikeEventRecordFailures.inc();
  metrics.objectStorageOperationFailures.inc({ operation: 'put' });
  metrics.mediaObjectOrphans.inc({
    feature: 'cake',
    operation: 'replace_previous_image',
  });

  monitoring.observeHomeRequest('success', 0.02);
  monitoring.countHomeDegraded();
  monitoring.observeHomeSection('recommendCakes', 'success', 'none', 0.01);
  monitoring.countDbCall('query');
  monitoring.countAiCall('vit', 'requested');
  monitoring.countCacheEvent('fresh_hit');
  monitoring.countCurationRun('success');
  monitoring.countCurationItems('refreshed', 1);
  monitoring.setCurationStaleBacklog(0);
}
