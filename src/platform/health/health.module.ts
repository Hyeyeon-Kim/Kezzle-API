import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from 'src/platform/config/app.config';
import { DependencyHealthModule } from './dependency-health.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { ReadinessState } from './readiness-state';

@Module({
  imports: [ConfigModule.forFeature(appConfig), DependencyHealthModule],
  controllers: [HealthController],
  providers: [HealthService, ReadinessState],
  exports: [ReadinessState],
})
export class HealthModule {}
