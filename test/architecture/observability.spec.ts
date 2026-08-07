import { readdirSync, readFileSync } from 'fs';
import { join, relative, sep } from 'path';
import observabilityContract from '../fixtures/observability-baseline.contract.json';

type SourceFile = {
  readonly path: string;
  readonly content: string;
};

const projectRoot = join(__dirname, '..', '..');
const sourceRoot = join(projectRoot, 'src');

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

function productionSources(): SourceFile[] {
  return readSourceFiles().filter(
    (source) => !source.path.endsWith('.spec.ts'),
  );
}

function moduleName(content: string): string | undefined {
  return content.match(/export class (\w+Module)/)?.[1];
}

function metricDeclarations(content: string): string[] {
  return [...content.matchAll(/\bname:\s*['"]([A-Za-z_:][A-Za-z0-9_:]*)['"]/g)]
    .map((match) => match[1])
    .sort();
}

function customMetrics() {
  return [
    ...observabilityContract.customMetricGroups.featureAdapters.customMetrics,
    ...observabilityContract.customMetricGroups.homeAndCurationAdapters
      .customMetrics,
  ];
}

function histogramSeriesNames(): string[] {
  return customMetrics()
    .filter((metric) => metric.type === 'histogram')
    .flatMap((metric) => [
      `${metric.name}_bucket`,
      `${metric.name}_count`,
      `${metric.name}_sum`,
    ]);
}

function collectExpressions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectExpressions);
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  return Object.entries(value).flatMap(([key, nested]) =>
    key === 'expr' && typeof nested === 'string'
      ? [nested]
      : collectExpressions(nested),
  );
}

function prometheusMetricTokens(expression: string): string[] {
  const sanitized = expression
    .replace(/"(?:\\.|[^"\\])*"/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\$[A-Za-z_][A-Za-z0-9_]*/g, '');

  return [...sanitized.matchAll(/\b([A-Za-z_:][A-Za-z0-9_:]*)\b/g)]
    .filter(
      (match) =>
        sanitized.slice(match.index! + match[0].length).trim()[0] !== '(',
    )
    .map((match) => match[1])
    .filter((token) => token.includes('_') || token.includes(':'));
}

describe('Observability architecture', () => {
  const sources = productionSources();
  const moduleSources = sources.filter((source) =>
    source.path.endsWith('.module.ts'),
  );

  it('forbids global feature providers and freezes explicit module imports', () => {
    const globalModules = moduleSources
      .filter((source) => /@Global\(\)/.test(source.content))
      .map((source) => moduleName(source.content))
      .filter(Boolean)
      .sort();
    const registryConsumers = moduleSources
      .filter((source) =>
        /(?:observability\/prometheus\/|\.\/)prometheus-registry\.module/.test(
          source.content,
        ),
      )
      .map((source) => moduleName(source.content))
      .filter(Boolean)
      .sort();
    const endpointConsumers = moduleSources
      .filter((source) =>
        /observability\/prometheus\/prometheus-endpoint\.module/.test(
          source.content,
        ),
      )
      .map((source) => moduleName(source.content))
      .filter(Boolean)
      .sort();

    expect(globalModules).toEqual(
      observabilityContract.moduleDependencies.decoratedGlobalModules,
    );
    expect(registryConsumers).toEqual(
      observabilityContract.moduleDependencies
        .prometheusRegistryModuleConsumers,
    );
    expect(endpointConsumers).toEqual(
      observabilityContract.moduleDependencies
        .prometheusEndpointModuleConsumers,
    );
  });

  it('keeps Registry, default collection, and endpoint serialization single-owned', () => {
    const registryConstruction = sources.flatMap((source) =>
      [...source.content.matchAll(/new Registry\(\)/g)].map(() => source.path),
    );
    const defaultCollection = sources.flatMap((source) =>
      [...source.content.matchAll(/collectDefaultMetrics\s*\(/g)].map(
        () => source.path,
      ),
    );
    const globalRegisterUsage = sources.flatMap((source) =>
      /\bregister\s*\.|import\s*\{[^}]*\bregister\b[^}]*\}\s*from\s*['"]prom-client['"]/.test(
        source.content,
      )
        ? [source.path]
        : [],
    );
    const controller = readFileSync(
      join(sourceRoot, 'observability/prometheus/prometheus.controller.ts'),
      'utf8',
    );

    expect(registryConstruction).toEqual([
      'observability/prometheus/prometheus-registry.provider.ts',
    ]);
    expect(defaultCollection).toEqual([
      'observability/prometheus/prometheus-registry.provider.ts',
    ]);
    expect(globalRegisterUsage).toEqual([]);
    expect(controller).toContain('@Inject(PROMETHEUS_REGISTRY)');
    expect(controller.match(/registry\.metrics\(\)/g)).toHaveLength(
      observabilityContract.canonicalRegistry.endpointSerializationCount,
    );
    expect(controller).not.toMatch(
      /MetricsAdapter|\.concat\(|\.join\(|\+\s*await/,
    );
  });

  it('keeps every custom metric family unique and feature-owned', () => {
    const actualOwners = Object.fromEntries(
      sources
        .filter((source) =>
          /new\s+(?:Counter|Gauge|Histogram)\s*\(/.test(source.content),
        )
        .map((source): [string, string[]] => [
          `src/${source.path}`,
          metricDeclarations(source.content),
        ])
        .sort(([left], [right]) => left.localeCompare(right)),
    );
    const expectedOwners = Object.fromEntries(
      Object.entries(
        observabilityContract.moduleDependencies.featureMetricOwners,
      )
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([path, metrics]) => [path, [...metrics].sort()]),
    );
    const allMetrics = Object.values(actualOwners).flat();

    expect(actualOwners).toEqual(expectedOwners);
    expect(new Set(allMetrics).size).toBe(allMetrics.length);
    expect(allMetrics).toHaveLength(
      observabilityContract.canonicalRegistry.customMetricFamilyCount,
    );
  });

  it('keeps application ports and Home consumers independent from Prometheus', () => {
    const applicationPrometheusImports = sources
      .filter(
        (source) =>
          source.path.includes('/application/') ||
          source.path.endsWith('.port.ts'),
      )
      .filter((source) =>
        /prom-client|PROMETHEUS_REGISTRY/.test(source.content),
      )
      .map((source) => source.path);
    const homeConsumers = [
      'home/application/home-feed.service.ts',
      'home/application/home-section.loader.ts',
      'home/infrastructure/cache/redis-home-cache.adapter.ts',
    ].map((path) => ({
      path,
      content: readFileSync(join(sourceRoot, path), 'utf8'),
    }));

    expect(applicationPrometheusImports).toEqual([]);
    for (const consumer of homeConsumers) {
      expect(consumer.content).toContain('HomeMetrics');
      expect(consumer.content).not.toMatch(
        /prom-client|PROMETHEUS_REGISTRY|MetricsAdapter|\bRegistry\b/,
      );
    }
  });

  it('allows Grafana queries to reference only canonical or recording metrics', () => {
    const recordingRules = readFileSync(
      join(projectRoot, 'monitoring/rules/home-recording.rules.yml'),
      'utf8',
    );
    const recordingNames = [
      ...recordingRules.matchAll(/^\s*- record:\s*(\S+)\s*$/gm),
    ].map((match) => match[1]);
    const allowedMetrics = new Set([
      ...observabilityContract.canonicalRegistry.defaultMetricFamilies,
      ...customMetrics().map((metric) => metric.name),
      ...histogramSeriesNames(),
      ...recordingNames,
      ...observabilityContract.externalMetricFamilies,
    ]);
    const dashboards = Object.keys(
      observabilityContract.repositoryMetricConsumers,
    ).filter((path) => path.endsWith('.json'));
    const unknownMetrics = dashboards.flatMap((path) => {
      const dashboard = JSON.parse(
        readFileSync(join(projectRoot, path), 'utf8'),
      );
      return collectExpressions(dashboard)
        .flatMap(prometheusMetricTokens)
        .filter((metric) => !allowedMetrics.has(metric))
        .map((metric) => `${path}: ${metric}`);
    });

    expect(unknownMetrics).toEqual([]);
  });
});
