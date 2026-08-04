import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { monitorEventLoopDelay } from 'perf_hooks';
import { Counter, Histogram, Registry } from 'prom-client';
import { PROMETHEUS_REGISTRY } from 'src/observability/prometheus/prometheus.constants';
import { HomeMetrics } from '../application/home-metrics.port';
import {
  HomeAiDependency,
  HomeCacheEvent,
  HomeDetailSectionName,
  HomeRequestStatus,
  HomeSectionFallbackReason,
  HomeSectionName,
  HomeSectionStatus,
} from '../application/home-metrics.types';

type SectionMetric = {
  count: number;
  durationMs: number;
};

type HomeMetricContext = {
  requestId: string;
  startedAt: bigint;
  dbCalls: number;
  aiCalls: number;
  aiErrors: number;
  backgroundRefreshCalls: number;
  cache: HomeCacheCounters;
  sections: Partial<Record<HomeDetailSectionName, SectionMetric>>;
};

type HomeCacheCounters = Record<HomeCacheEvent, number>;

const HOME_DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2];
const SECTION_DURATION_BUCKETS = [
  0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5,
];

function emptyCacheCounters(): HomeCacheCounters {
  return {
    fresh_hit: 0,
    stale_hit: 0,
    miss: 0,
    refresh: 0,
    error: 0,
  };
}

@Injectable()
export class PrometheusHomeMetricsAdapter
  extends HomeMetrics
  implements OnModuleDestroy
{
  private readonly storage = new AsyncLocalStorage<HomeMetricContext>();
  private readonly eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
  private readonly cacheTotals = emptyCacheCounters();

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

  constructor(
    @Inject(PROMETHEUS_REGISTRY)
    private readonly registry: Registry,
  ) {
    super();
    this.eventLoopDelay.enable();
  }

  onModuleDestroy(): void {
    this.eventLoopDelay.disable();
  }

  run<T>(callback: () => Promise<T>): Promise<T> {
    const context: HomeMetricContext = {
      requestId: randomUUID(),
      startedAt: process.hrtime.bigint(),
      dbCalls: 0,
      aiCalls: 0,
      aiErrors: 0,
      backgroundRefreshCalls: 0,
      cache: emptyCacheCounters(),
      sections: {},
    };

    return this.storage.run(context, callback);
  }

  async timeSection<T>(
    name: HomeDetailSectionName,
    callback: () => Promise<T>,
  ): Promise<T> {
    const context = this.storage.getStore();
    if (!context) {
      return callback();
    }

    const startedAt = process.hrtime.bigint();
    try {
      return await callback();
    } finally {
      const durationMs = this.toMs(process.hrtime.bigint() - startedAt);
      const section = context.sections[name] ?? { count: 0, durationMs: 0 };
      section.count += 1;
      section.durationMs += durationMs;
      context.sections[name] = section;
    }
  }

  observeRequest(status: HomeRequestStatus, durationSeconds: number): void {
    this.homeRequests.inc({ status });
    this.homeRequestDuration.observe({ status }, durationSeconds);
  }

  observeSection(
    section: HomeSectionName,
    status: HomeSectionStatus,
    reason: HomeSectionFallbackReason,
    durationSeconds: number,
  ): void {
    this.sectionRequests.inc({ section, status, reason });
    this.sectionDuration.observe({ section, status }, durationSeconds);
  }

  countDegraded(): void {
    this.homeDegraded.inc();
  }

  countDb(calls = 1): void {
    this.dbCalls.inc({ operation: 'query' }, calls);
    const context = this.storage.getStore();
    if (context) {
      context.dbCalls += calls;
    }
  }

  countAi(dependency: HomeAiDependency, calls = 1): void {
    const context = this.storage.getStore();
    if (context) {
      this.aiCalls.inc({ dependency, result: 'requested' }, calls);
      context.aiCalls += calls;
    }
  }

  countAiError(dependency: HomeAiDependency, calls = 1): void {
    const context = this.storage.getStore();
    if (context) {
      this.aiCalls.inc({ dependency, result: 'error' }, calls);
      context.aiErrors += calls;
    }
  }

  countBackgroundRefresh(calls = 1): void {
    const context = this.storage.getStore();
    if (context) {
      context.backgroundRefreshCalls += calls;
    }
  }

  countCache(event: HomeCacheEvent, calls = 1): void {
    this.cacheEvents.inc({ event }, calls);
    this.cacheTotals[event] += calls;
    const context = this.storage.getStore();
    if (context) {
      context.cache[event] += calls;
    }
  }

  flush(status: HomeRequestStatus): void {
    const context = this.storage.getStore();
    if (!context || !this.isJsonFlushEnabled()) {
      return;
    }

    console.log(
      JSON.stringify({
        type: 'home_resilience_metric',
        requestId: context.requestId,
        status,
        totalDurationMs: this.toMs(process.hrtime.bigint() - context.startedAt),
        dbCalls: context.dbCalls,
        aiCalls: context.aiCalls,
        aiErrors: context.aiErrors,
        backgroundRefreshCalls: context.backgroundRefreshCalls,
        cache: context.cache,
        cacheTotals: { ...this.cacheTotals },
        eventLoopLagMs: {
          mean: this.nanoToMs(this.eventLoopDelay.mean),
          p95: this.nanoToMs(this.eventLoopDelay.percentile(95)),
          max: this.nanoToMs(this.eventLoopDelay.max),
        },
        sections: context.sections,
      }),
    );
  }

  private isJsonFlushEnabled(): boolean {
    return process.env.HOME_RESILIENCE_METRICS_ENABLED === 'true';
  }

  private toMs(duration: bigint): number {
    return Number(duration) / 1_000_000;
  }

  private nanoToMs(duration: number): number {
    return Number.isFinite(duration) ? duration / 1_000_000 : 0;
  }
}
