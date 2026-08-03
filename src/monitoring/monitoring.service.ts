import { Inject, Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';
import { PROMETHEUS_REGISTRY } from 'src/observability/prometheus/prometheus.constants';

export type HomeRequestStatus = 'success' | 'error';
export type HomeSectionName =
  | 'recommendCakes'
  | 'anniversary'
  | 'popularCakes'
  | 'keywordRanks'
  | 'newestCakes'
  | 'curations';
export type AiDependency = 'vit' | 'clip';
export type AiCallResult = 'requested' | 'error';
export type CacheEvent =
  | 'fresh_hit'
  | 'stale_hit'
  | 'miss'
  | 'refresh'
  | 'error';
export type CurationRunResult = 'success' | 'failure' | 'skipped';
export type CurationItemResult = 'refreshed' | 'skipped' | 'failed';

// label 값은 고정 allowlist만 사용한다. requestId/userId/cakeId/key/error message를
// label로 넣으면 series cardinality가 폭증하므로 금지한다.
const HOME_DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2];
const SECTION_DURATION_BUCKETS = [
  0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5,
];

@Injectable()
export class MonitoringService {
  constructor(
    @Inject(PROMETHEUS_REGISTRY)
    readonly registry: Registry,
  ) {}

  private readonly homeRequests = new Counter({
    name: 'kezzle_home_requests_total',
    help: 'Total home API requests by final status',
    labelNames: ['status'] as const,
    registers: [this.registry],
  });

  private readonly homeRequestDuration = new Histogram({
    name: 'kezzle_home_request_duration_seconds',
    help: 'Home API request duration in seconds',
    labelNames: ['status'] as const,
    buckets: HOME_DURATION_BUCKETS,
    registers: [this.registry],
  });

  private readonly homeDegraded = new Counter({
    name: 'kezzle_home_degraded_total',
    help: 'Home API responses served with at least one fallback section',
    registers: [this.registry],
  });

  private readonly sectionRequests = new Counter({
    name: 'kezzle_home_section_requests_total',
    help: 'Home section executions by status and fallback reason',
    labelNames: ['section', 'status', 'reason'] as const,
    registers: [this.registry],
  });

  private readonly sectionDuration = new Histogram({
    name: 'kezzle_home_section_duration_seconds',
    help: 'Home section duration in seconds',
    labelNames: ['section', 'status'] as const,
    buckets: SECTION_DURATION_BUCKETS,
    registers: [this.registry],
  });

  private readonly dbCalls = new Counter({
    name: 'kezzle_home_db_calls_total',
    help: 'Logical MongoDB calls issued by instrumented home paths',
    labelNames: ['operation'] as const,
    registers: [this.registry],
  });

  private readonly aiCalls = new Counter({
    name: 'kezzle_home_ai_calls_total',
    help: 'AI dependency calls by dependency and result',
    labelNames: ['dependency', 'result'] as const,
    registers: [this.registry],
  });

  private readonly cacheEvents = new Counter({
    name: 'kezzle_home_cache_events_total',
    help: 'Home cache lookup/refresh/error events',
    labelNames: ['event'] as const,
    registers: [this.registry],
  });

  private readonly curationRuns = new Counter({
    name: 'kezzle_curation_refresh_runs_total',
    help: 'Curation refresh job runs by result',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });

  private readonly curationItems = new Counter({
    name: 'kezzle_curation_refresh_items_total',
    help: 'Curation refresh item outcomes',
    labelNames: ['result'] as const,
    registers: [this.registry],
  });

  private readonly curationStaleBacklog = new Gauge({
    name: 'kezzle_curation_stale_backlog',
    help: 'Stale curations found by the last refresh job run',
    registers: [this.registry],
  });

  observeHomeRequest(status: HomeRequestStatus, durationSeconds: number): void {
    this.homeRequests.inc({ status });
    this.homeRequestDuration.observe({ status }, durationSeconds);
  }

  countHomeDegraded(): void {
    this.homeDegraded.inc();
  }

  observeHomeSection(
    section: HomeSectionName,
    status: 'success' | 'fallback',
    reason: 'none' | 'timeout' | 'dependency_error',
    durationSeconds: number,
  ): void {
    this.sectionRequests.inc({ section, status, reason });
    this.sectionDuration.observe({ section, status }, durationSeconds);
  }

  countDbCall(operation = 'query', calls = 1): void {
    this.dbCalls.inc({ operation }, calls);
  }

  countAiCall(dependency: AiDependency, result: AiCallResult, calls = 1): void {
    this.aiCalls.inc({ dependency, result }, calls);
  }

  countCacheEvent(event: CacheEvent, calls = 1): void {
    this.cacheEvents.inc({ event }, calls);
  }

  countCurationRun(result: CurationRunResult): void {
    this.curationRuns.inc({ result });
  }

  countCurationItems(result: CurationItemResult, count: number): void {
    if (count > 0) {
      this.curationItems.inc({ result }, count);
    }
  }

  setCurationStaleBacklog(count: number): void {
    this.curationStaleBacklog.set(count);
  }

  contentType(): string {
    return this.registry.contentType;
  }

  metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
