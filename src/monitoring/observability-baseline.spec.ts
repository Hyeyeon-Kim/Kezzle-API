import {
  GLOBAL_MODULE_METADATA,
  MODULE_METADATA,
  PARAMTYPES_METADATA,
} from '@nestjs/common/constants';
import { readdirSync, readFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { Registry } from 'prom-client';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { AiSearchModule } from 'src/ai-search/ai-search.module';
import { AppModule } from 'src/app.module';
import { CakeModule } from 'src/cake/cake.module';
import { CatalogQueryModule } from 'src/catalog/catalog-query.module';
import { CurationModule } from 'src/curation/curation.module';
import { CurationRefreshService } from 'src/curation/curation-refresh.service';
import { HomeModule } from 'src/home/home.module';
import { HomeFeedService } from 'src/home/home-feed.service';
import { HomeResilienceMetricsModule } from 'src/home-resilience/home-resilience-metrics.module';
import { HomeResilienceMetricsService } from 'src/home-resilience/home-resilience-metrics.service';
import { LikeModule } from 'src/like/like.module';
import { ObjectStorageModule } from 'src/media/object-storage.module';
import { MetricsModule } from 'src/metrics/metrics.module';
import { MetricsService } from 'src/metrics/metrics.service';
import { PROMETHEUS_REGISTRY } from 'src/observability/prometheus/prometheus.constants';
import { PrometheusEndpointModule } from 'src/observability/prometheus/prometheus-endpoint.module';
import { PrometheusRegistryModule } from 'src/observability/prometheus/prometheus-registry.module';
import { createPrometheusRegistry } from 'src/observability/prometheus/prometheus-registry.provider';
import { SearchModule } from 'src/search/search.module';
import { StoreModule } from 'src/store/store.module';
import observabilityBaseline from '../../test/fixtures/observability-baseline.contract.json';
import { MonitoringModule } from './monitoring.module';
import { MonitoringService } from './monitoring.service';

type RuntimeMetric = {
  readonly name: string;
  readonly help: string;
  readonly type: string;
  readonly labelNames?: string[];
  readonly buckets?: number[];
};

type MetricDescriptor = {
  readonly field: string;
  readonly name: string;
  readonly help: string;
  readonly type: string;
  readonly labelNames: string[];
  readonly buckets?: number[];
};

type SourceFile = {
  readonly path: string;
  readonly content: string;
};

const projectRoot = join(__dirname, '..', '..');
const sourceRoot = join(projectRoot, 'src');
const metricTokenPattern =
  /\b(?:kezzle_[A-Za-z0-9_:]+|ai_api_[A-Za-z0-9_:]+|similar_search_[A-Za-z0-9_:]+|store_query_[A-Za-z0-9_:]+|search_event_[A-Za-z0-9_:]+|cake_like_[A-Za-z0-9_:]+|object_storage_[A-Za-z0-9_:]+|media_object_[A-Za-z0-9_:]+|(?:job|section|dependency):[A-Za-z0-9_:]+)\b/g;

function readSourceFiles(directory = sourceRoot): SourceFile[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return readSourceFiles(absolutePath);
    }
    if (!entry.isFile() || !entry.name.endsWith('.ts')) {
      return [];
    }
    return [
      {
        path: relative(sourceRoot, absolutePath).split(sep).join('/'),
        content: readFileSync(absolutePath, 'utf8'),
      },
    ];
  });
}

function customMetricDescriptors(service: object): MetricDescriptor[] {
  return Object.entries(service)
    .filter(([, value]) => isRuntimeMetric(value))
    .map(([field, metric]) => ({
      field,
      name: metric.name,
      help: metric.help,
      type: metric.type,
      labelNames: [...(metric.labelNames ?? [])],
      ...(metric.buckets === undefined ? {} : { buckets: [...metric.buckets] }),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function isRuntimeMetric(value: unknown): value is RuntimeMetric {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<RuntimeMetric>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.help === 'string' &&
    typeof candidate.type === 'string'
  );
}

async function defaultMetricFamilies(
  registry: Registry,
  customMetrics: readonly MetricDescriptor[],
): Promise<string[]> {
  const customNames = new Set(customMetrics.map((metric) => metric.name));
  return (await registry.getMetricsAsJSON())
    .map((metric) => metric.name)
    .filter((name) => !customNames.has(name));
}

function moduleMetadata(module: object, key: string): unknown[] {
  return Reflect.getMetadata(key, module) ?? [];
}

function metricTokens(path: string): string[] {
  const content = readFileSync(join(projectRoot, path), 'utf8');
  return [...new Set(content.match(metricTokenPattern) ?? [])].sort();
}

describe('Observability Phase C explicit module wiring', () => {
  it('uses one registry for compatibility services and keeps only prefixed defaults', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MetricsModule, MonitoringModule, PrometheusEndpointModule],
    }).compile();
    const registry = moduleRef.get<Registry>(PROMETHEUS_REGISTRY);
    const metricsService = moduleRef.get(MetricsService);
    const monitoringService = moduleRef.get(MonitoringService);
    const metricsCustom = customMetricDescriptors(metricsService);
    const monitoringCustom = customMetricDescriptors(monitoringService);
    const defaultMetrics = await defaultMetricFamilies(registry, [
      ...metricsCustom,
      ...monitoringCustom,
    ]);

    expect(metricsService.registry).toBe(registry);
    expect(monitoringService.registry).toBe(registry);
    expect(defaultMetrics).toEqual(
      expect.arrayContaining(
        observabilityBaseline.registries.monitoringService
          .defaultMetricFamilies,
      ),
    );
    expect(defaultMetrics.every((name) => name.startsWith('kezzle_'))).toBe(
      true,
    );
    expect(defaultMetrics).not.toEqual(
      expect.arrayContaining(
        observabilityBaseline.registries.metricsService.defaultMetricFamilies,
      ),
    );

    await moduleRef.close();
  });

  it('freezes custom metric names, HELP/TYPE, labels, and histogram buckets', () => {
    const registry = createPrometheusRegistry();
    const metricsService = new MetricsService(registry);
    const monitoringService = new MonitoringService(registry);

    expect(customMetricDescriptors(metricsService)).toEqual(
      observabilityBaseline.registries.metricsService.customMetrics,
    );
    expect(customMetricDescriptors(monitoringService)).toEqual(
      observabilityBaseline.registries.monitoringService.customMetrics,
    );
  });

  it('records dashboard, recording-rule, and alert-rule metric consumers', () => {
    for (const [path, expectedTokens] of Object.entries(
      observabilityBaseline.repositoryMetricConsumers,
    )) {
      expect(metricTokens(path)).toEqual(expectedTokens);
    }
  });

  it('records the Phase C explicit observability module ownership', () => {
    const moduleSources = readSourceFiles().filter((source) =>
      source.path.endsWith('.module.ts'),
    );
    const decoratedGlobalModules = moduleSources
      .filter((source) => /@Global\(\)/.test(source.content))
      .map((source) => source.content.match(/export class (\w+Module)/)?.[1])
      .filter(Boolean)
      .sort();
    const metricsModuleConsumers = moduleSources
      .filter((source) =>
        /(?:src\/metrics\/metrics\.module|\.\/metrics\/metrics\.module)/.test(
          source.content,
        ),
      )
      .map((source) => source.content.match(/export class (\w+Module)/)?.[1])
      .filter(Boolean)
      .sort();
    const monitoringModuleConsumers = moduleSources
      .filter((source) =>
        /(?:src\/monitoring\/monitoring\.module|\.\/monitoring\/monitoring\.module)/.test(
          source.content,
        ),
      )
      .map((source) => source.content.match(/export class (\w+Module)/)?.[1])
      .filter(Boolean)
      .sort();
    const prometheusEndpointModuleConsumers = moduleSources
      .filter((source) =>
        /observability\/prometheus\/prometheus-endpoint\.module/.test(
          source.content,
        ),
      )
      .map((source) => source.content.match(/export class (\w+Module)/)?.[1])
      .filter(Boolean)
      .sort();
    const prometheusRegistryModuleConsumers = moduleSources
      .filter((source) =>
        /(?:observability\/prometheus\/|\.\/)prometheus-registry\.module/.test(
          source.content,
        ),
      )
      .map((source) => source.content.match(/export class (\w+Module)/)?.[1])
      .filter(Boolean)
      .sort();

    expect(
      Reflect.getMetadata(GLOBAL_MODULE_METADATA, MonitoringModule),
    ).not.toBe(true);
    expect(decoratedGlobalModules).toEqual([]);
    expect(metricsModuleConsumers).toEqual(
      observabilityBaseline.moduleDependencies.metricsModuleExplicitConsumers.filter(
        (moduleName) => moduleName !== 'MonitoringModule',
      ),
    );
    expect(monitoringModuleConsumers).toEqual([
      'CurationModule',
      'HomeModule',
      'HomeResilienceMetricsModule',
    ]);
    expect(prometheusEndpointModuleConsumers).toEqual(['AppModule']);
    expect(prometheusRegistryModuleConsumers).toEqual([
      'MetricsModule',
      'MonitoringModule',
      'PrometheusEndpointModule',
    ]);
    expect(
      Reflect.getMetadata(GLOBAL_MODULE_METADATA, PrometheusRegistryModule),
    ).not.toBe(true);
    expect(
      Reflect.getMetadata(GLOBAL_MODULE_METADATA, PrometheusEndpointModule),
    ).not.toBe(true);

    expect(moduleMetadata(AppModule, MODULE_METADATA.IMPORTS)).toContain(
      PrometheusEndpointModule,
    );
    expect(moduleMetadata(MetricsModule, MODULE_METADATA.IMPORTS)).toContain(
      PrometheusRegistryModule,
    );
    expect(moduleMetadata(MonitoringModule, MODULE_METADATA.IMPORTS)).toContain(
      PrometheusRegistryModule,
    );
    expect(
      moduleMetadata(PrometheusEndpointModule, MODULE_METADATA.IMPORTS),
    ).toEqual([PrometheusRegistryModule]);
  });

  it('keeps Registry construction and default collection in one production factory', () => {
    const productionSource = readSourceFiles()
      .filter((source) => !source.path.endsWith('.spec.ts'))
      .map((source) => source.content)
      .join('\n');

    expect(productionSource.match(/new Registry\(\)/g)).toHaveLength(1);
    expect(productionSource.match(/collectDefaultMetrics\s*\(/g)).toHaveLength(
      1,
    );
  });

  it('makes every MonitoringService dependency explicit in module metadata', () => {
    const explicitConsumers = [
      {
        module: CurationModule,
        provider: CurationRefreshService,
      },
      {
        module: HomeModule,
        provider: HomeFeedService,
      },
      {
        module: HomeResilienceMetricsModule,
        provider: HomeResilienceMetricsService,
      },
    ].map(({ module, provider }) => {
      const imports = moduleMetadata(module, MODULE_METADATA.IMPORTS);
      const providers = moduleMetadata(module, MODULE_METADATA.PROVIDERS);
      const dependencies =
        (Reflect.getMetadata(PARAMTYPES_METADATA, provider) as unknown[]) ?? [];

      expect(imports).toContain(MonitoringModule);
      expect(providers).toContain(provider);
      expect(dependencies).toContain(MonitoringService);

      return { module: module.name, provider: provider.name };
    });

    expect(explicitConsumers).toEqual([
      {
        module: 'CurationModule',
        provider: 'CurationRefreshService',
      },
      {
        module: 'HomeModule',
        provider: 'HomeFeedService',
      },
      {
        module: 'HomeResilienceMetricsModule',
        provider: 'HomeResilienceMetricsService',
      },
    ]);
  });

  it('keeps every MetricsService consumer behind an explicit MetricsModule import', () => {
    const consumers = new Map([
      ['ai-search/clip-client.ts', AiSearchModule],
      ['ai-search/vit-client.ts', AiSearchModule],
      ['cake/cake-media.service.ts', CakeModule],
      ['catalog/similar-cake-catalog-query.service.ts', CatalogQueryModule],
      ['like/like.service.ts', LikeModule],
      [
        'media/infrastructure/s3-object-storage.adapter.ts',
        ObjectStorageModule,
      ],
      ['search/search.service.ts', SearchModule],
      ['store/store-media.service.ts', StoreModule],
    ]);
    const consumerPaths = readSourceFiles()
      .filter((source) => !source.path.endsWith('.spec.ts'))
      .filter((source) => /src\/metrics\/metrics\.service/.test(source.content))
      .map((source) => source.path)
      .sort();

    expect(consumerPaths).toEqual([...consumers.keys()].sort());
    for (const ownerModule of consumers.values()) {
      expect(moduleMetadata(ownerModule, MODULE_METADATA.IMPORTS)).toContain(
        MetricsModule,
      );
    }
  });

  it('compiles HomeResilienceMetricsModule without AppModule globals', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HomeResilienceMetricsModule],
    }).compile();

    expect(moduleRef.get(HomeResilienceMetricsService)).toBeDefined();
    expect(moduleRef.get(MonitoringService)).toBeDefined();
    await moduleRef.close();
  });

  it('compiles CurationModule with only non-observability platform stubs', async () => {
    const connectionToken = getConnectionToken('kezzle');
    const moduleRef = await Test.createTestingModule({
      imports: [CurationModule],
    })
      .useMocker((token) => {
        if (token === connectionToken) {
          return { models: {}, model: jest.fn().mockReturnValue({}) };
        }
        if (token === ConfigService) {
          return { get: jest.fn().mockReturnValue('0') };
        }
        if (token === SchedulerRegistry) {
          return { addInterval: jest.fn() };
        }
        if (token === MonitoringService) {
          throw new Error(
            'MonitoringService must resolve from MonitoringModule',
          );
        }
        throw new Error(`Unexpected missing provider: ${String(token)}`);
      })
      .compile();

    expect(moduleRef.get(CurationRefreshService)).toBeDefined();
    expect(moduleRef.get(MonitoringService)).toBeDefined();
    await moduleRef.close();
  });
});
