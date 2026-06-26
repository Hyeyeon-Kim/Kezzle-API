import { Global, Module } from '@nestjs/common';
import { HomeResilienceMetricsService } from './home-resilience-metrics.service';

@Global()
@Module({
  providers: [HomeResilienceMetricsService],
  exports: [HomeResilienceMetricsService],
})
export class HomeResilienceMetricsModule {}
