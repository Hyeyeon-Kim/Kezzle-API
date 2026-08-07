import { Module } from '@nestjs/common';
import { PrometheusRegistryModule } from 'src/observability/prometheus/prometheus-registry.module';
import { HomeMetrics } from '../../application/port/home-metrics.port';
import { PrometheusHomeMetricsAdapter } from './prometheus-home-metrics.adapter';
import { ConfigModule } from '@nestjs/config';
import homeConfig from 'src/config/home.config';

@Module({
  imports: [ConfigModule.forFeature(homeConfig), PrometheusRegistryModule],
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
