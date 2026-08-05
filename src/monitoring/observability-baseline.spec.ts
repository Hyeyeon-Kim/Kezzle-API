import {
  GLOBAL_MODULE_METADATA,
  MODULE_METADATA,
} from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { readdirSync, readFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { Registry } from 'prom-client';
import { AiSearchMetricsAdapter } from 'src/ai-search/ai-search-metrics.adapter';
import { AppModule } from 'src/app.module';
import { CatalogMetricsAdapter } from 'src/catalog/catalog-metrics.adapter';
import { CurationRefreshMetricsAdapter } from 'src/curation/curation-refresh-metrics.adapter';
import { CurationRefreshService } from 'src/curation/curation-refresh.service';
import { CurationModule } from 'src/curation/curation.module';
import { HomeCacheModule } from 'src/home-cache/home-cache.module';
import { HomeCacheService } from 'src/home-cache/home-cache.service';
import { HomeMetrics } from 'src/home/application/home-metrics.port';
import { HomeFeedService } from 'src/home/home-feed.service';
import { HomeModule } from 'src/home/home.module';
import { HomeObservabilityModule } from 'src/home/observability/home-observability.module';
import { PrometheusHomeMetricsAdapter } from 'src/home/observability/prometheus-home-metrics.adapter';
import { CakeLikeEventMetricsAdapter } from 'src/like/cake-like-event-metrics.adapter';
import { MediaMetricsAdapter } from 'src/media/media-metrics.adapter';
import { PROMETHEUS_REGISTRY } from 'src/observability/prometheus/prometheus.constants';
import { PrometheusEndpointModule } from 'src/observability/prometheus/prometheus-endpoint.module';
import { PrometheusRegistryModule } from 'src/observability/prometheus/prometheus-registry.module';
import { createPrometheusRegistry } from 'src/observability/prometheus/prometheus-registry.provider';
import { SearchEventMetricsAdapter } from 'src/search/search-event-metrics.adapter';
import observabilityBaseline from '../../test/fixtures/observability-baseline.contract.json';

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

function metricContracts(descriptors: readonly MetricDescriptor[]) {
  return descriptors.map(({ name, help, type, labelNames, buckets }) => ({
    name,
    help,
    type,
    labelNames,
    ...(buckets === undefined ? {} : { buckets }),
  }));
}

async function defaultMetricFamilies(
  registry: Registry,
  customMetrics: readonly MetricDescriptor[],
): Promise<string[]> {
  const customNames = new Set(customMetrics.map((metric) => metric.name));
  return (await registry.getMetricsAsJSON())
    .map((metric) => metric.name)
    .filter((name) => !customNames.has(name))
    .sort();
}

function moduleMetadata(module: object, key: string): unknown[] {
  return Reflect.getMetadata(key, module) ?? [];
}

function metricTokens(path: string): string[] {
  const content = readFileSync(join(projectRoot, path), 'utf8');
  return [...new Set(content.match(metricTokenPattern) ?? [])].sort();
}

describe('Observability Phase F canonical contract', () => {
  it('registers every feature adapter in one registry', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PrometheusRegistryModule,
        HomeObservabilityModule,
        PrometheusEndpointModule,
      ],
      providers: [
        AiSearchMetricsAdapter,
        CatalogMetricsAdapter,
        SearchEventMetricsAdapter,
        CakeLikeEventMetricsAdapter,
        MediaMetricsAdapter,
        CurationRefreshMetricsAdapter,
      ],
    }).compile();
    const registry = moduleRef.get<Registry>(PROMETHEUS_REGISTRY);
    const featureCustom = [
      AiSearchMetricsAdapter,
      CatalogMetricsAdapter,
      SearchEventMetricsAdapter,
      CakeLikeEventMetricsAdapter,
      MediaMetricsAdapter,
    ]
      .flatMap((adapter) => customMetricDescriptors(moduleRef.get(adapter)))
      .sort((left, right) => left.name.localeCompare(right.name));
    const homeAndCurationCustom = [
      moduleRef.get<HomeMetrics>(HomeMetrics),
      moduleRef.get(CurationRefreshMetricsAdapter),
    ]
      .flatMap(customMetricDescriptors)
      .sort((left, right) => left.name.localeCompare(right.name));
    const defaultMetrics = await defaultMetricFamilies(registry, [
      ...featureCustom,
      ...homeAndCurationCustom,
    ]);

    expect(metricContracts(featureCustom)).toEqual(
      metricContracts(
        observabilityBaseline.customMetricGroups.featureAdapters.customMetrics,
      ),
    );
    expect(metricContracts(homeAndCurationCustom)).toEqual(
      metricContracts(
        observabilityBaseline.customMetricGroups.homeAndCurationAdapters
          .customMetrics,
      ),
    );
    expect(defaultMetrics).toEqual(
      observabilityBaseline.canonicalRegistry.defaultMetricFamilies,
    );
    expect(defaultMetrics.every((name) => name.startsWith('kezzle_'))).toBe(
      true,
    );

    await moduleRef.close();
  });

  it('freezes custom names, HELP/TYPE, labels, and histogram buckets', () => {
    const registry = createPrometheusRegistry();
    const featureAdapters = [
      new AiSearchMetricsAdapter(registry),
      new CatalogMetricsAdapter(registry),
      new SearchEventMetricsAdapter(registry),
      new CakeLikeEventMetricsAdapter(registry),
      new MediaMetricsAdapter(registry),
    ];
    const homeAdapter = new PrometheusHomeMetricsAdapter(registry, {
      hardDeadlineMs: 600,
      sectionTimeoutMs: {
        recommendCakes: 250,
        anniversary: 250,
        popularCakes: 50,
        keywordRanks: 400,
        newestCakes: 100,
        curations: 100,
      },
      jsonMetricsEnabled: false,
      cache: {} as never,
    });
    const curationAdapter = new CurationRefreshMetricsAdapter(registry);

    expect(
      metricContracts(
        featureAdapters
          .flatMap(customMetricDescriptors)
          .sort((left, right) => left.name.localeCompare(right.name)),
      ),
    ).toEqual(
      metricContracts(
        observabilityBaseline.customMetricGroups.featureAdapters.customMetrics,
      ),
    );
    expect(
      metricContracts(
        [homeAdapter, curationAdapter]
          .flatMap(customMetricDescriptors)
          .sort((left, right) => left.name.localeCompare(right.name)),
      ),
    ).toEqual(
      metricContracts(
        observabilityBaseline.customMetricGroups.homeAndCurationAdapters
          .customMetrics,
      ),
    );
    homeAdapter.onModuleDestroy();
  });

  it('records dashboard, recording-rule, and alert-rule consumers', () => {
    for (const [path, expectedTokens] of Object.entries(
      observabilityBaseline.repositoryMetricConsumers,
    )) {
      expect(metricTokens(path)).toEqual(expectedTokens);
    }
  });

  it('makes Home and Curation registry ownership explicit', () => {
    const moduleSources = readSourceFiles().filter((source) =>
      source.path.endsWith('.module.ts'),
    );
    const decoratedGlobalModules = moduleSources
      .filter((source) => /@Global\(\)/.test(source.content))
      .map((source) => source.content.match(/export class (\w+Module)/)?.[1])
      .filter(Boolean)
      .sort();
    const prometheusRegistryConsumers = moduleSources
      .filter((source) =>
        /(?:observability\/prometheus\/|\.\/)prometheus-registry\.module/.test(
          source.content,
        ),
      )
      .map((source) => source.content.match(/export class (\w+Module)/)?.[1])
      .filter(Boolean)
      .sort();

    expect(decoratedGlobalModules).toEqual([]);
    expect(prometheusRegistryConsumers).toEqual(
      observabilityBaseline.moduleDependencies
        .prometheusRegistryModuleConsumers,
    );
    expect(moduleMetadata(AppModule, MODULE_METADATA.IMPORTS)).toContain(
      PrometheusEndpointModule,
    );
    expect(moduleMetadata(CurationModule, MODULE_METADATA.IMPORTS)).toContain(
      PrometheusRegistryModule,
    );
    expect(moduleMetadata(CurationModule, MODULE_METADATA.PROVIDERS)).toContain(
      CurationRefreshMetricsAdapter,
    );
    expect(
      moduleMetadata(HomeObservabilityModule, MODULE_METADATA.IMPORTS),
    ).toContain(PrometheusRegistryModule);
    expect(moduleMetadata(HomeModule, MODULE_METADATA.IMPORTS)).toContain(
      HomeObservabilityModule,
    );
    expect(moduleMetadata(HomeCacheModule, MODULE_METADATA.IMPORTS)).toContain(
      HomeObservabilityModule,
    );
    expect(
      Reflect.getMetadata(GLOBAL_MODULE_METADATA, PrometheusRegistryModule),
    ).not.toBe(true);
  });

  it('keeps consumers on semantic ports and removes compatibility production boundaries', () => {
    const productionSources = readSourceFiles().filter(
      (source) => !source.path.endsWith('.spec.ts'),
    );
    const productionContent = productionSources
      .map((source) => source.content)
      .join('\n');
    const retiredIdentifiers = [
      ['Monitoring', 'Service'].join(''),
      ['Monitoring', 'Module'].join(''),
      ['HomeResilienceMetrics', 'Service'].join(''),
    ];

    for (const identifier of retiredIdentifiers) {
      expect(productionContent).not.toContain(identifier);
    }
    expect(
      productionSources.filter((source) =>
        source.path.startsWith('home-resilience/'),
      ),
    ).toEqual([]);

    const homeFeedSource = readFileSync(
      join(sourceRoot, 'home/home-feed.service.ts'),
      'utf8',
    );
    const homeCacheSource = readFileSync(
      join(sourceRoot, 'home-cache/home-cache.service.ts'),
      'utf8',
    );
    expect(homeFeedSource).toContain('HomeMetrics');
    expect(homeFeedSource).not.toMatch(/prom-client|Registry|MetricsAdapter/);
    expect(homeCacheSource).toContain('HomeMetrics');
    expect(homeCacheSource).not.toMatch(/prom-client|Registry|MetricsAdapter/);
    expect(moduleMetadata(HomeModule, MODULE_METADATA.PROVIDERS)).toContain(
      HomeFeedService,
    );
    expect(
      moduleMetadata(HomeCacheModule, MODULE_METADATA.PROVIDERS),
    ).toContain(HomeCacheService);
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

  it('compiles Home observability without AppModule globals', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [HomeObservabilityModule],
    }).compile();

    expect(moduleRef.get(HomeMetrics)).toBeDefined();
    await moduleRef.close();
  });

  it('compiles CurationModule with only platform stubs', async () => {
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
          return {
            addInterval: jest.fn(),
            doesExist: jest.fn().mockReturnValue(false),
            deleteInterval: jest.fn(),
          };
        }
        throw new Error(`Unexpected missing provider: ${String(token)}`);
      })
      .compile();

    expect(moduleRef.get(CurationRefreshService)).toBeDefined();
    expect(moduleRef.get(CurationRefreshMetricsAdapter)).toBeDefined();
    await moduleRef.close();
  });
});
