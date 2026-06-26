import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { monitorEventLoopDelay } from 'perf_hooks';

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
  sections: Record<string, SectionMetric>;
};

@Injectable()
export class HomeResilienceMetricsService {
  private readonly storage = new AsyncLocalStorage<HomeMetricContext>();
  private readonly eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });

  constructor() {
    this.eventLoopDelay.enable();
  }

  isEnabled(): boolean {
    return process.env.HOME_RESILIENCE_METRICS_ENABLED === 'true';
  }

  run<T>(callback: () => Promise<T>): Promise<T> {
    if (!this.isEnabled()) {
      return callback();
    }

    const context: HomeMetricContext = {
      requestId: randomUUID(),
      startedAt: process.hrtime.bigint(),
      dbCalls: 0,
      aiCalls: 0,
      aiErrors: 0,
      backgroundRefreshCalls: 0,
      sections: {},
    };

    return this.storage.run(context, callback);
  }

  async timeSection<T>(name: string, callback: () => Promise<T>): Promise<T> {
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

  countDb(calls = 1): void {
    const context = this.storage.getStore();
    if (context) {
      context.dbCalls += calls;
    }
  }

  countAi(calls = 1): void {
    const context = this.storage.getStore();
    if (context) {
      context.aiCalls += calls;
    }
  }

  countAiError(calls = 1): void {
    const context = this.storage.getStore();
    if (context) {
      context.aiErrors += calls;
    }
  }

  countBackgroundRefresh(calls = 1): void {
    const context = this.storage.getStore();
    if (context) {
      context.backgroundRefreshCalls += calls;
    }
  }

  flush(status: 'success' | 'error'): void {
    const context = this.storage.getStore();
    if (!context) {
      return;
    }

    const totalDurationMs = this.toMs(
      process.hrtime.bigint() - context.startedAt,
    );

    console.log(
      JSON.stringify({
        type: 'home_resilience_metric',
        requestId: context.requestId,
        status,
        totalDurationMs,
        dbCalls: context.dbCalls,
        aiCalls: context.aiCalls,
        aiErrors: context.aiErrors,
        backgroundRefreshCalls: context.backgroundRefreshCalls,
        eventLoopLagMs: {
          mean: this.nanoToMs(this.eventLoopDelay.mean),
          p95: this.nanoToMs(this.eventLoopDelay.percentile(95)),
          max: this.nanoToMs(this.eventLoopDelay.max),
        },
        sections: context.sections,
      }),
    );
  }

  private toMs(duration: bigint): number {
    return Number(duration) / 1_000_000;
  }

  private nanoToMs(duration: number): number {
    if (!Number.isFinite(duration)) {
      return 0;
    }

    return duration / 1_000_000;
  }
}
