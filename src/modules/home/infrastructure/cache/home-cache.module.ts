import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { HomeObservabilityModule } from 'src/modules/home/infrastructure/observability/home-observability.module';
import { HOME_CACHE_REDIS } from './home-cache.constants';
import { HomeCacheService } from './home-cache.service';
import { ConfigModule, ConfigType } from '@nestjs/config';
import homeConfig from 'src/platform/config/home.config';

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
    HomeCacheService,
  ],
  exports: [HomeCacheService],
})
export class HomeCacheModule {}
