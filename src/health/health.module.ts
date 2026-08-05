import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from 'src/config/app.config';
import { HomeCacheModule } from 'src/home-cache/home-cache.module';
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
