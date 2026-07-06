import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { HomeResilienceMetricsService } from 'src/home-resilience/home-resilience-metrics.service';
import { HOME_CACHE_REDIS } from './home-cache.constants';
import { positiveEnvMs, SwrEnvelope, SwrOptions } from './swr';

@Injectable()
export class HomeCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(HomeCacheService.name);
  private redisAvailable = true;

  constructor(
    @Inject(HOME_CACHE_REDIS) private readonly redis: Redis | null,
    private readonly homeMetrics: HomeResilienceMetricsService,
  ) {
    this.redis?.on('ready', () => this.markAvailable());
    this.redis?.on('error', (error) => this.markUnavailable(error));
  }

  async getWithSwr<T>(options: SwrOptions<T>): Promise<T> {
    if (!this.redis) {
      return options.refresh();
    }

    let envelope: SwrEnvelope<T> | null;
    try {
      envelope = await this.read<T>(options.key);
      this.markAvailable();
    } catch (error) {
      this.countCacheError(error);
      return options.refresh();
    }

    const now = Date.now();
    if (envelope && now < envelope.freshUntil) {
      this.homeMetrics.countCache('fresh_hit');
      return envelope.value;
    }

    if (envelope && now < envelope.staleUntil) {
      this.homeMetrics.countCache('stale_hit');
      void this.refreshStale(options);
      return envelope.value;
    }

    this.homeMetrics.countCache('miss');
    return this.refreshAndStore(options);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis && this.redis.status !== 'end') {
      await this.redis.quit().catch(() => this.redis.disconnect());
    }
  }

  private async read<T>(key: string): Promise<SwrEnvelope<T> | null> {
    const raw = await this.redis.get(key);
    if (!raw) {
      return null;
    }

    try {
      const envelope = JSON.parse(raw) as SwrEnvelope<T>;
      if (
        !envelope ||
        !Number.isFinite(envelope.freshUntil) ||
        !Number.isFinite(envelope.staleUntil) ||
        !Object.prototype.hasOwnProperty.call(envelope, 'value')
      ) {
        throw new Error('Invalid cache envelope');
      }
      return envelope;
    } catch {
      this.logger.warn(`discarding invalid home cache value: key=${key}`);
      await this.redis.del(key);
      return null;
    }
  }

  private async refreshAndStore<T>(options: SwrOptions<T>): Promise<T> {
    this.homeMetrics.countCache('refresh');
    const value = await options.refresh();
    await this.write(options, value).catch((error) =>
      this.countCacheError(error),
    );
    return value;
  }

  private async refreshStale<T>(options: SwrOptions<T>): Promise<void> {
    const lockKey = `${options.key}:lock`;
    const lockToken = randomUUID();
    const lockTtlMs = positiveEnvMs('HOME_CACHE_LOCK_TTL_MS', 10_000);

    try {
      const acquired = await this.redis.set(
        lockKey,
        lockToken,
        'PX',
        lockTtlMs,
        'NX',
      );
      if (acquired !== 'OK') {
        return;
      }
    } catch (error) {
      this.countCacheError(error);
      return;
    }

    this.homeMetrics.countCache('refresh');
    try {
      const value = await options.refresh();
      await this.write(options, value);
    } catch (error) {
      this.logger.warn(
        `home cache stale refresh failed: key=${
          options.key
        } error=${this.errorName(error)}`,
      );
    } finally {
      await this.releaseLock(lockKey, lockToken);
    }
  }

  private async write<T>(options: SwrOptions<T>, value: T): Promise<void> {
    const now = Date.now();
    const staleTtlMs = Math.max(options.freshTtlMs, options.staleTtlMs);
    const envelope: SwrEnvelope<T> = {
      value,
      freshUntil: now + this.jitteredFreshTtl(options.freshTtlMs, staleTtlMs),
      staleUntil: now + staleTtlMs,
    };

    await this.redis.set(
      options.key,
      JSON.stringify(envelope),
      'PX',
      staleTtlMs,
    );
    this.markAvailable();
  }

  private jitteredFreshTtl(freshTtlMs: number, staleTtlMs: number): number {
    const configured = Number(process.env.HOME_CACHE_TTL_JITTER_PERCENT);
    const jitterPercent =
      Number.isFinite(configured) && configured >= 0
        ? Math.min(configured, 100)
        : 10;
    const ratio = jitterPercent / 100;
    const jittered = freshTtlMs * (1 - ratio + Math.random() * ratio * 2);
    return Math.max(1, Math.min(Math.round(jittered), staleTtlMs));
  }

  private async releaseLock(key: string, token: string): Promise<void> {
    try {
      await this.redis.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        key,
        token,
      );
    } catch (error) {
      this.countCacheError(error);
    }
  }

  private countCacheError(error: unknown): void {
    this.homeMetrics.countCache('error');
    this.markUnavailable(error);
  }

  private markAvailable(): void {
    if (!this.redisAvailable) {
      this.logger.log('home cache Redis connection recovered');
    }
    this.redisAvailable = true;
  }

  private markUnavailable(error: unknown): void {
    if (this.redisAvailable) {
      this.logger.warn(
        `home cache Redis unavailable: error=${this.errorName(error)}`,
      );
    }
    this.redisAvailable = false;
  }

  private errorName(error: unknown): string {
    return error instanceof Error
      ? `${error.name}: ${error.message}`
      : 'UnknownError';
  }
}
