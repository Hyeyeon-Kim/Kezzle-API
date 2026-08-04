import { Module } from '@nestjs/common';
import { PrometheusRegistryModule } from 'src/observability/prometheus/prometheus-registry.module';
import { HomeMetrics } from '../application/home-metrics.port';
import { PrometheusHomeMetricsAdapter } from './prometheus-home-metrics.adapter';

@Module({
  imports: [PrometheusRegistryModule],
  providers: [
    PrometheusHomeMetricsAdapter,
    {
      provide: HomeMetrics,
      useExisting: PrometheusHomeMetricsAdapter,
    },
  ],
  exports: [HomeMetrics],
})
export class HomeObservabilityModule {}
