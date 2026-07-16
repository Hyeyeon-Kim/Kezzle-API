import { Module } from '@nestjs/common';
import { HomeResilienceMetricsService } from './home-resilience-metrics.service';

@Module({
  providers: [HomeResilienceMetricsService],
  exports: [HomeResilienceMetricsService],
})
export class HomeResilienceMetricsModule {}
