import { Module } from '@nestjs/common';
import { MonitoringModule } from 'src/monitoring/monitoring.module';
import { HomeResilienceMetricsService } from './home-resilience-metrics.service';

@Module({
  imports: [MonitoringModule],
  providers: [HomeResilienceMetricsService],
  exports: [HomeResilienceMetricsService],
})
export class HomeResilienceMetricsModule {}
