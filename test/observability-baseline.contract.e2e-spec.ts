import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AiSearchMetricsAdapter } from 'src/ai-search/ai-search-metrics.adapter';
import { IS_PUBLIC_KEY } from 'src/auth/decorators/public.decorator';
import { CatalogMetricsAdapter } from 'src/catalog/catalog-metrics.adapter';
import { CakeLikeEventMetricsAdapter } from 'src/like/cake-like-event-metrics.adapter';
import { MediaMetricsAdapter } from 'src/media/media-metrics.adapter';
import { MonitoringModule } from 'src/monitoring/monitoring.module';
import { MonitoringService } from 'src/monitoring/monitoring.service';
import { PROMETHEUS_REGISTRY } from 'src/observability/prometheus/prometheus.constants';
import { PrometheusEndpointModule } from 'src/observability/prometheus/prometheus-endpoint.module';
import { PrometheusRegistryModule } from 'src/observability/prometheus/prometheus-registry.module';
import { SearchEventMetricsAdapter } from 'src/search/search-event-metrics.adapter';
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
  let aiMetrics: AiSearchMetricsAdapter;
  let catalogMetrics: CatalogMetricsAdapter;
  let searchMetrics: SearchEventMetricsAdapter;
  let likeMetrics: CakeLikeEventMetricsAdapter;
  let mediaMetrics: MediaMetricsAdapter;
  let monitoringService: MonitoringService;
  let registry: Registry;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PrometheusRegistryModule,
        MonitoringModule,
        PrometheusEndpointModule,
      ],
      providers: [
        AiSearchMetricsAdapter,
        CatalogMetricsAdapter,
        SearchEventMetricsAdapter,
        CakeLikeEventMetricsAdapter,
        MediaMetricsAdapter,
        { provide: APP_GUARD, useClass: PublicMetadataOnlyGuard },
      ],
    }).compile();

    aiMetrics = moduleRef.get(AiSearchMetricsAdapter);
    catalogMetrics = moduleRef.get(CatalogMetricsAdapter);
    searchMetrics = moduleRef.get(SearchEventMetricsAdapter);
    likeMetrics = moduleRef.get(CakeLikeEventMetricsAdapter);
    mediaMetrics = moduleRef.get(MediaMetricsAdapter);
    monitoringService = moduleRef.get(MonitoringService);
    registry = moduleRef.get(PROMETHEUS_REGISTRY);
    seedAllCustomMetrics({
      aiMetrics,
      catalogMetrics,
      searchMetrics,
      likeMetrics,
      mediaMetrics,
      monitoringService,
    });

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

function seedAllCustomMetrics(metrics: {
  aiMetrics: AiSearchMetricsAdapter;
  catalogMetrics: CatalogMetricsAdapter;
  searchMetrics: SearchEventMetricsAdapter;
  likeMetrics: CakeLikeEventMetricsAdapter;
  mediaMetrics: MediaMetricsAdapter;
  monitoringService: MonitoringService;
}): void {
  metrics.catalogMetrics.startSimilarSearch()('success');
  metrics.catalogMetrics.startStoreQuery()();
  metrics.aiMetrics.startCall({ model: 'vit', endpoint: '/similar' })(
    'success',
  );
  metrics.aiMetrics.countError({
    reason: 'timeout',
    model: 'clip',
    endpoint: '/search',
  });
  metrics.searchMetrics.countRecordFailure();
  metrics.likeMetrics.countRecordFailure();
  metrics.mediaMetrics.countStorageFailure('put');
  metrics.mediaMetrics.countOrphan('cake', 'replace_previous_image');

  metrics.monitoringService.observeHomeRequest('success', 0.02);
  metrics.monitoringService.countHomeDegraded();
  metrics.monitoringService.observeHomeSection(
    'recommendCakes',
    'success',
    'none',
    0.01,
  );
  metrics.monitoringService.countDbCall('query');
  metrics.monitoringService.countAiCall('vit', 'requested');
  metrics.monitoringService.countCacheEvent('fresh_hit');
  metrics.monitoringService.countCurationRun('success');
  metrics.monitoringService.countCurationItems('refreshed', 1);
  metrics.monitoringService.setCurationStaleBacklog(0);
}
