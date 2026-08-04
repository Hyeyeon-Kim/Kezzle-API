import { readFileSync } from 'fs';
import { join } from 'path';
import observabilityContract from '../fixtures/observability-baseline.contract.json';

type PrometheusTarget = {
  readonly labels?: Record<string, string>;
  readonly health?: string;
  readonly scrapeUrl?: string;
  readonly lastError?: string;
};

type PrometheusRule = {
  readonly name?: string;
  readonly health?: string;
};

const prometheusUrl = trimSlash(
  process.env.PROMETHEUS_URL ?? 'http://127.0.0.1:9090',
);
const grafanaUrl = trimSlash(
  process.env.GRAFANA_URL ?? 'http://127.0.0.1:3001',
);
const apiUrl = trimSlash(process.env.KEZZLE_API_URL ?? 'http://127.0.0.1:3000');
const projectRoot = process.env.PROJECT_ROOT ?? join(__dirname, '..', '..');

async function main(): Promise<void> {
  const targets = await fetchJson<{
    data?: { activeTargets?: PrometheusTarget[] };
  }>(`${prometheusUrl}/api/v1/targets`);
  const apiTarget = targets.data?.activeTargets?.find(
    (target) => target.labels?.job === 'kezzle-api',
  );
  assert(
    apiTarget?.health === 'up' && apiTarget.scrapeUrl?.endsWith('/metrics'),
    `kezzle-api target is not UP: ${JSON.stringify(apiTarget)}`,
  );

  const rules = await fetchJson<{
    data?: { groups?: Array<{ rules?: PrometheusRule[] }> };
  }>(`${prometheusUrl}/api/v1/rules?type=record`);
  const recordingRules = (rules.data?.groups ?? []).flatMap(
    (group) => group.rules ?? [],
  );
  const homeRequestRateRule = recordingRules.find(
    (rule) => rule.name === 'job:home_request_rate:rate1m',
  );
  assert(
    homeRequestRateRule?.health === 'ok',
    `Home request recording rule is not healthy: ${JSON.stringify(
      homeRequestRateRule,
    )}`,
  );

  const recordingResult = await prometheusQuery('job:home_request_rate:rate1m');
  assert(
    recordingResult.data?.result?.length > 0,
    'Home request recording series was not generated',
  );

  const metricNames = await fetchJson<{ data?: string[] }>(
    `${prometheusUrl}/api/v1/label/__name__/values`,
  );
  const metricNameSet = new Set(metricNames.data ?? []);
  const missingExternalMetrics =
    observabilityContract.externalMetricFamilies.filter(
      (metric) => !metricNameSet.has(metric),
    );
  assert(
    missingExternalMetrics.length === 0,
    `Exporter metric families are missing: ${missingExternalMetrics.join(
      ', ',
    )}`,
  );

  const dashboard = JSON.parse(
    readFileSync(
      join(projectRoot, 'monitoring/grafana/dashboards/home-api.json'),
      'utf8',
    ),
  );
  const dashboardExpressions = collectExpressions(dashboard);
  for (const expression of dashboardExpressions) {
    await prometheusQuery(expression);
  }

  const grafanaHealth = await fetchJson<{ database?: string }>(
    `${grafanaUrl}/api/health`,
  );
  assert(
    grafanaHealth.database === 'ok',
    `Grafana database is not healthy: ${JSON.stringify(grafanaHealth)}`,
  );

  const metricsResponse = await fetch(
    `${apiUrl}${observabilityContract.http.path}`,
  );
  assert(
    metricsResponse.ok,
    `/metrics returned HTTP ${metricsResponse.status}`,
  );
  const metricsText = await metricsResponse.text();
  const families = [...metricsText.matchAll(/^# HELP (\S+) /gm)].map(
    (match) => match[1],
  );
  const unprefixedDefaults =
    observabilityContract.canonicalRegistry.defaultMetricFamilies
      .map((metric) => metric.replace(/^kezzle_/, ''))
      .filter((metric) => families.includes(metric));

  assert(
    families.length ===
      observabilityContract.canonicalRegistry.metricFamilyCount,
    `Unexpected metric family count: ${families.length}`,
  );
  assert(
    new Set(families).size === families.length,
    'Duplicate metric families are exposed',
  );
  assert(
    unprefixedDefaults.length === 0,
    `Unprefixed defaults are exposed: ${unprefixedDefaults.join(', ')}`,
  );

  console.log(
    JSON.stringify({
      apiTarget: {
        health: apiTarget.health,
        scrapeUrl: apiTarget.scrapeUrl,
        lastError: apiTarget.lastError ?? '',
      },
      recordingRule: {
        name: homeRequestRateRule.name,
        health: homeRequestRateRule.health,
        resultSeries: recordingResult.data.result.length,
      },
      dashboardQueryCount: dashboardExpressions.length,
      externalMetricFamilyCount:
        observabilityContract.externalMetricFamilies.length,
      metricFamilyCount: families.length,
      scrapePayloadBytes: Buffer.byteLength(metricsText),
      grafanaDatabase: grafanaHealth.database,
    }),
  );
}

async function prometheusQuery(expression: string) {
  const url = new URL(`${prometheusUrl}/api/v1/query`);
  url.searchParams.set('query', expression);
  const response = await fetchJson<{
    status?: string;
    error?: string;
    data?: { result?: unknown[] };
  }>(url.toString());
  assert(
    response.status === 'success',
    `Prometheus rejected query ${expression}: ${response.error ?? 'unknown'}`,
  );
  return response;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  assert(response.ok, `${url} returned HTTP ${response.status}`);
  return (await response.json()) as T;
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

function trimSlash(value: string): string {
  return value.replace(/\/$/, '');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
