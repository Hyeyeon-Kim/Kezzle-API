import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { HomeCachePort } from 'src/home/application/port/home-cache.port';
import { HomeObservabilityModule } from 'src/home/infrastructure/observability/home-observability.module';
import { HOME_CACHE_REDIS } from './home-cache.constants';
import { RedisHomeCacheAdapter } from './redis-home-cache.adapter';
import { ConfigModule, ConfigType } from '@nestjs/config';
import homeConfig from 'src/config/home.config';

@Module({
  imports: [ConfigModule.forFeature(homeConfig), HomeObservabilityModule],
  providers: [
    {
      provide: HOME_CACHE_REDIS,
      inject: [homeConfig.KEY],
      useFactory: (config: ConfigType<typeof homeConfig>): Redis | null => {
        if (!config.cache.redisUrl) {
          return null;
        }
        return new Redis(config.cache.redisUrl, {
          commandTimeout: config.cache.commandTimeoutMs,
          connectTimeout: config.cache.connectTimeoutMs,
          enableOfflineQueue: false,
          enableReadyCheck: false,
          maxRetriesPerRequest: 0,
          retryStrategy: (attempt) => Math.min(attempt * 100, 1000),
        });
      },
    },
    RedisHomeCacheAdapter,
    {
      provide: HomeCachePort,
      useExisting: RedisHomeCacheAdapter,
    },
  ],
  exports: [HomeCachePort],
})
export class HomeCacheModule {}
