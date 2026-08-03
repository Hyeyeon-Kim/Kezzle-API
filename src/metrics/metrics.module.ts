import { Module } from '@nestjs/common';
import { PrometheusRegistryModule } from 'src/observability/prometheus/prometheus-registry.module';
import { MetricsService } from './metrics.service';

@Module({
  imports: [PrometheusRegistryModule],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
