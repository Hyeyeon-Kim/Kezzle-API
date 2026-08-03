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
import { MetricsModule } from 'src/metrics/metrics.module';
import { MetricsService } from 'src/metrics/metrics.service';
import { MonitoringModule } from 'src/monitoring/monitoring.module';
import { MonitoringService } from 'src/monitoring/monitoring.service';
import { PROMETHEUS_REGISTRY } from 'src/observability/prometheus/prometheus.constants';
import { PrometheusEndpointModule } from 'src/observability/prometheus/prometheus-endpoint.module';
import { Registry } from 'prom-client';
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

describe('Observability Phase B HTTP contract', () => {
  let app: INestApplication;
  let metricsService: MetricsService;
  let monitoringService: MonitoringService;
  let registry: Registry;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MetricsModule, MonitoringModule, PrometheusEndpointModule],
      providers: [{ provide: APP_GUARD, useClass: PublicMetadataOnlyGuard }],
    }).compile();

    metricsService = moduleRef.get(MetricsService);
    monitoringService = moduleRef.get(MonitoringService);
    registry = moduleRef.get(PROMETHEUS_REGISTRY);
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

  it('serializes the single registry once and exposes every custom metric contract', async () => {
    const metricsSpy = jest.spyOn(registry, 'metrics');
    const response = await request(app.getHttpServer())
      .get(observabilityBaseline.http.path)
      .expect(200);

    expect(metricsSpy).toHaveBeenCalledTimes(1);
    metricsSpy.mockRestore();

    const customMetrics = [
      ...observabilityBaseline.registries.metricsService.customMetrics,
      ...observabilityBaseline.registries.monitoringService.customMetrics,
    ];
    for (const metric of customMetrics) {
      expect(response.text).toContain(`# HELP ${metric.name} ${metric.help}`);
      expect(response.text).toContain(`# TYPE ${metric.name} ${metric.type}`);
    }
  });

  it('keeps kezzle-prefixed defaults and removes unprefixed duplicates', async () => {
    const response = await request(app.getHttpServer())
      .get(observabilityBaseline.http.path)
      .expect(200);

    const unprefixed =
      observabilityBaseline.registries.metricsService.defaultMetricFamilies;
    const prefixed =
      observabilityBaseline.registries.monitoringService.defaultMetricFamilies;

    for (const metricName of prefixed) {
      expect(response.text).toContain(`# HELP ${metricName} `);
      expect(response.text).toContain(`# TYPE ${metricName} `);
    }
    for (const metricName of unprefixed) {
      expect(response.text).not.toContain(`# HELP ${metricName} `);
      expect(response.text).not.toContain(`# TYPE ${metricName} `);
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
