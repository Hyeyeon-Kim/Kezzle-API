import { readFileSync } from 'fs';
import { join } from 'path';
import observabilityContract from '../fixtures/observability-baseline.contract.json';
import { readResponseWithinDeadline, waitWithinDeadline } from './smoke-http';

export type PrometheusTarget = {
  readonly labels?: Record<string, string>;
  readonly health?: string;
  readonly scrapeUrl?: string;
  readonly lastError?: string;
};

type PrometheusRule = {
  readonly name?: string;
  readonly health?: string;
};

type GrafanaDatasource = {
  readonly uid?: string;
  readonly type?: string;
  readonly url?: string;
  readonly readOnly?: boolean;
};

type GrafanaDashboardResponse = {
  readonly meta?: {
    readonly provisioned?: boolean;
    readonly folderTitle?: string;
  };
  readonly dashboard?: {
    readonly uid?: string;
    readonly title?: string;
    readonly [key: string]: unknown;
  };
};

const prometheusUrl = trimSlash(
  process.env.PROMETHEUS_URL ?? 'http://127.0.0.1:9090',
);
const grafanaUrl = trimSlash(
  process.env.GRAFANA_URL ?? 'http://127.0.0.1:3001',
);
const apiUrl = trimSlash(process.env.KEZZLE_API_URL ?? 'http://127.0.0.1:3000');
const projectRoot = process.env.PROJECT_ROOT ?? join(__dirname, '..', '..');
const timeoutMs = positiveNumber(
  process.env.OBSERVABILITY_SMOKE_TIMEOUT_MS,
  30_000,
);
const pollIntervalMs = 1_000;
const prometheusDatasourceUid = 'kezzle-prometheus';
const prometheusDatasourceUrl = 'http://prometheus:9090';
const homeDashboardUid = 'kezzle-home-api';
const homeDashboardTitle = 'Kezzle Home API';

async function main(): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const { apiTarget, mongodbTarget, redisTarget } =
    await waitForHealthyTargets(deadline);

  const rules = await fetchJson<{
    data?: { groups?: Array<{ rules?: PrometheusRule[] }> };
  }>(`${prometheusUrl}/api/v1/rules?type=record`, deadline);
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

  const homeStatus = await readResponseWithinDeadline(
    `${apiUrl}/curation`,
    deadline,
    async (response) => {
      await response.arrayBuffer();
      return { ok: response.ok, status: response.status };
    },
    homeTrafficRequestInit(),
  );
  assert(homeStatus.ok, `/curation returned HTTP ${homeStatus.status}`);

  const recordingResult = await waitForPrometheusResult(
    'job:home_request_rate:rate1m',
    deadline,
  );

  const metricNames = await fetchJson<{ data?: string[] }>(
    `${prometheusUrl}/api/v1/label/__name__/values`,
    deadline,
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
    await prometheusQuery(expression, deadline);
  }

  const grafanaAuth = grafanaRequestInit();
  const grafanaHealth = await fetchJson<{ database?: string }>(
    `${grafanaUrl}/api/health`,
    deadline,
    grafanaAuth,
  );
  assert(
    grafanaHealth.database === 'ok',
    `Grafana database is not healthy: ${JSON.stringify(grafanaHealth)}`,
  );

  const grafanaDatasource = await fetchJson<GrafanaDatasource>(
    `${grafanaUrl}/api/datasources/uid/${prometheusDatasourceUid}`,
    deadline,
    grafanaAuth,
  );
  const grafanaDashboard = await fetchJson<GrafanaDashboardResponse>(
    `${grafanaUrl}/api/dashboards/uid/${homeDashboardUid}`,
    deadline,
    grafanaAuth,
  );
  assertGrafanaProvisioning(grafanaDatasource, grafanaDashboard);

  const metricsResult = await readResponseWithinDeadline(
    `${apiUrl}${observabilityContract.http.path}`,
    deadline,
    async (response) => ({
      ok: response.ok,
      status: response.status,
      text: await response.text(),
    }),
  );
  assert(metricsResult.ok, `/metrics returned HTTP ${metricsResult.status}`);
  const metricsText = metricsResult.text;
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
      exporterTargets: {
        mongodb: targetSummary(mongodbTarget),
        redis: targetSummary(redisTarget),
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
      grafanaDatasource: grafanaDatasource.uid,
      grafanaDashboard: grafanaDashboard.dashboard?.uid,
    }),
  );
}

async function waitForPrometheusResult(expression: string, deadline: number) {
  let lastFailure = 'recording series is empty';

  while (Date.now() < deadline) {
    try {
      const response = await prometheusQuery(expression, deadline);
      if ((response.data?.result?.length ?? 0) > 0) {
        return response;
      }
      lastFailure = 'recording series is empty';
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    await waitWithinDeadline(deadline, pollIntervalMs);
  }

  throw new Error(
    `Home request recording series was not generated after ${timeoutMs}ms: ${lastFailure}`,
  );
}

async function prometheusQuery(expression: string, deadline: number) {
  const url = new URL(`${prometheusUrl}/api/v1/query`);
  url.searchParams.set('query', expression);
  const response = await fetchJson<{
    status?: string;
    error?: string;
    data?: { result?: unknown[] };
  }>(url.toString(), deadline);
  assert(
    response.status === 'success',
    `Prometheus rejected query ${expression}: ${response.error ?? 'unknown'}`,
  );
  return response;
}

async function fetchJson<T>(
  url: string,
  deadline: number,
  init: RequestInit = {},
): Promise<T> {
  return readResponseWithinDeadline(
    url,
    deadline,
    async (response) => {
      assert(response.ok, `${url} returned HTTP ${response.status}`);
      return (await response.json()) as T;
    },
    init,
  );
}

export function homeTrafficRequestInit(
  token = process.env.KEZZLE_API_BEARER_TOKEN,
): RequestInit {
  return token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : { headers: {} };
}

export function grafanaRequestInit(
  serviceAccountToken = process.env.GRAFANA_SERVICE_ACCOUNT_TOKEN,
  username = process.env.GRAFANA_USERNAME,
  password = process.env.GRAFANA_PASSWORD,
): RequestInit {
  if (serviceAccountToken) {
    return {
      headers: { Authorization: `Bearer ${serviceAccountToken}` },
    };
  }

  assert(
    Boolean(username) === Boolean(password),
    'GRAFANA_USERNAME and GRAFANA_PASSWORD must be configured together',
  );

  if (username && password) {
    const credentials = Buffer.from(`${username}:${password}`).toString(
      'base64',
    );
    return { headers: { Authorization: `Basic ${credentials}` } };
  }

  return { headers: {} };
}

type HealthyTargets = {
  readonly apiTarget: PrometheusTarget;
  readonly mongodbTarget: PrometheusTarget;
  readonly redisTarget: PrometheusTarget;
};

type FetchTargets = () => Promise<readonly PrometheusTarget[]>;

export async function waitForHealthyTargets(
  deadline: number,
  fetchTargets: FetchTargets = async () => {
    const response = await fetchJson<{
      data?: { activeTargets?: PrometheusTarget[] };
    }>(`${prometheusUrl}/api/v1/targets`, deadline);
    return response.data?.activeTargets ?? [];
  },
  intervalMs = pollIntervalMs,
): Promise<HealthyTargets> {
  const waitBudgetMs = Math.max(0, deadline - Date.now());
  let lastFailure = 'targets were not observed';

  while (Date.now() < deadline) {
    try {
      const activeTargets = await fetchTargets();
      return {
        apiTarget: requireHealthyTarget(
          activeTargets,
          'kezzle-api',
          '/metrics',
        ),
        mongodbTarget: requireHealthyTarget(
          activeTargets,
          'mongodb',
          'mongodb-exporter:9216/metrics',
        ),
        redisTarget: requireHealthyTarget(
          activeTargets,
          'redis',
          'redis-exporter:9121/metrics',
        ),
      };
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error);
    }

    await waitWithinDeadline(deadline, intervalMs);
  }

  throw new Error(
    `Prometheus targets did not become healthy after ${waitBudgetMs}ms: ${lastFailure}`,
  );
}

export function requireHealthyTarget(
  targets: readonly PrometheusTarget[],
  job: string,
  expectedScrapeUrlSuffix: string,
): PrometheusTarget {
  const target = targets.find((candidate) => candidate.labels?.job === job);
  assert(target, `Prometheus job=${job} target was not found`);
  assert(
    target.health === 'up',
    `Prometheus job=${job} target is not UP: ${JSON.stringify(target)}`,
  );
  assert(
    target.scrapeUrl?.endsWith(expectedScrapeUrlSuffix),
    `Prometheus job=${job} has unexpected scrapeUrl: ${target.scrapeUrl ?? ''}`,
  );
  assert(
    !target.lastError,
    `Prometheus job=${job} reported lastError: ${target.lastError}`,
  );
  return target;
}

export function assertGrafanaProvisioning(
  datasource: GrafanaDatasource,
  response: GrafanaDashboardResponse,
): void {
  assert(
    datasource.uid === prometheusDatasourceUid &&
      datasource.type === 'prometheus' &&
      datasource.url === prometheusDatasourceUrl &&
      datasource.readOnly === true,
    `Grafana Prometheus datasource is not provisioned as expected: ${JSON.stringify(
      datasource,
    )}`,
  );
  assert(
    response.meta?.provisioned === true &&
      response.dashboard?.uid === homeDashboardUid &&
      response.dashboard.title === homeDashboardTitle,
    `Grafana Home dashboard is not provisioned as expected: ${JSON.stringify(
      response,
    )}`,
  );

  const datasourceUids = collectDatasourceUids(response.dashboard);
  assert(
    datasourceUids.includes(prometheusDatasourceUid),
    `Grafana Home dashboard does not reference datasource ${prometheusDatasourceUid}`,
  );
}

function collectDatasourceUids(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectDatasourceUids);
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  return Object.entries(value).flatMap(([key, nested]) => {
    if (
      key === 'datasource' &&
      typeof nested === 'object' &&
      nested !== null &&
      'uid' in nested &&
      typeof nested.uid === 'string'
    ) {
      return [nested.uid];
    }
    return collectDatasourceUids(nested);
  });
}

function targetSummary(target: PrometheusTarget) {
  return {
    health: target.health,
    scrapeUrl: target.scrapeUrl,
    lastError: target.lastError ?? '',
  };
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

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
