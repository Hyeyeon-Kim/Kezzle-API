import { Module } from '@nestjs/common';
import { PrometheusRegistryModule } from 'src/observability/prometheus/prometheus-registry.module';
import { MediaMetricsAdapter } from './media-metrics.adapter';

@Module({
  imports: [PrometheusRegistryModule],
  providers: [MediaMetricsAdapter],
  exports: [MediaMetricsAdapter],
})
export class MediaObservabilityModule {}
