import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { HomeResilienceMetricsModule } from 'src/home-resilience/home-resilience-metrics.module';
import { HOME_CACHE_REDIS } from './home-cache.constants';
import { HomeCacheService } from './home-cache.service';
import { validateHomeCachePolicies } from './home-cache.policy';
import { positiveEnvMs } from './swr';

@Module({
  imports: [HomeResilienceMetricsModule],
  providers: [
    {
      provide: HOME_CACHE_REDIS,
      useFactory: (): Redis | null => {
        validateHomeCachePolicies();
        if (!process.env.REDIS_URL) {
          return null;
        }

        const commandTimeout = positiveEnvMs(
          'HOME_CACHE_COMMAND_TIMEOUT_MS',
          80,
        );
        const connectTimeout = positiveEnvMs(
          'HOME_CACHE_CONNECT_TIMEOUT_MS',
          1_000,
        );
        return new Redis(process.env.REDIS_URL, {
          commandTimeout,
          connectTimeout,
          enableOfflineQueue: false,
          enableReadyCheck: false,
          maxRetriesPerRequest: 0,
          retryStrategy: (attempt) => Math.min(attempt * 100, 1000),
        });
      },
    },
    HomeCacheService,
  ],
  exports: [HomeCacheService],
})
export class HomeCacheModule {}
