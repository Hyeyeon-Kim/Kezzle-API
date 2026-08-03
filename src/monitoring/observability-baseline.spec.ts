import {
  GLOBAL_MODULE_METADATA,
  MODULE_METADATA,
  PARAMTYPES_METADATA,
} from '@nestjs/common/constants';
import { readdirSync, readFileSync } from 'fs';
import { join, relative, sep } from 'path';
import { Registry } from 'prom-client';
import { CurationModule } from 'src/curation/curation.module';
import { CurationRefreshService } from 'src/curation/curation-refresh.service';
import { HomeResilienceMetricsModule } from 'src/home-resilience/home-resilience-metrics.module';
import { HomeResilienceMetricsService } from 'src/home-resilience/home-resilience-metrics.service';
import { MetricsService } from 'src/metrics/metrics.service';
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

describe('Observability Phase A baseline', () => {
  it('characterizes the two distinct registries and duplicated default metrics', async () => {
    const metricsService = new MetricsService();
    const monitoringService = new MonitoringService();
    const metricsCustom = customMetricDescriptors(metricsService);
    const monitoringCustom = customMetricDescriptors(monitoringService);
    const metricsDefaults = await defaultMetricFamilies(
      metricsService.registry,
      metricsCustom,
    );
    const monitoringDefaults = await defaultMetricFamilies(
      monitoringService.registry,
      monitoringCustom,
    );

    expect(metricsService.registry).not.toBe(monitoringService.registry);
    expect(metricsDefaults).toEqual(
      observabilityBaseline.registries.metricsService.defaultMetricFamilies,
    );
    expect(monitoringDefaults).toEqual(
      observabilityBaseline.registries.monitoringService.defaultMetricFamilies,
    );
    expect(monitoringDefaults).toEqual(
      metricsDefaults.map((name) => `kezzle_${name}`),
    );
  });

  it('freezes custom metric names, HELP/TYPE, labels, and histogram buckets', () => {
    const metricsService = new MetricsService();
    const monitoringService = new MonitoringService();

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

  it('freezes current global and explicit observability module imports', () => {
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

    expect(Reflect.getMetadata(GLOBAL_MODULE_METADATA, MonitoringModule)).toBe(
      true,
    );
    expect(decoratedGlobalModules).toEqual(
      observabilityBaseline.moduleDependencies.decoratedGlobalModules,
    );
    expect(metricsModuleConsumers).toEqual(
      observabilityBaseline.moduleDependencies.metricsModuleExplicitConsumers,
    );
    expect(monitoringModuleConsumers).toEqual(
      observabilityBaseline.moduleDependencies
        .monitoringModuleExplicitConsumers,
    );
  });

  it('characterizes hidden MonitoringService consumers in HomeResilience and Curation', () => {
    const hiddenConsumers = [
      {
        module: CurationModule,
        provider: CurationRefreshService,
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

      expect(imports).not.toContain(MonitoringModule);
      expect(providers).toContain(provider);
      expect(dependencies).toContain(MonitoringService);

      return { module: module.name, provider: provider.name };
    });

    expect(hiddenConsumers).toEqual(
      observabilityBaseline.moduleDependencies.hiddenMonitoringServiceConsumers,
    );
  });
});
