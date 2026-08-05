import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from 'src/platform/config/app.config';
import { HomeCacheModule } from 'src/modules/home/infrastructure/cache/home-cache.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { ReadinessState } from './readiness-state';

@Module({
  imports: [ConfigModule.forFeature(appConfig), HomeCacheModule],
  controllers: [HealthController],
  providers: [HealthService, ReadinessState],
  exports: [ReadinessState],
})
export class HealthModule {}
