import { Module } from '@nestjs/common';
import { PrometheusRegistryModule } from 'src/platform/observability/prometheus/prometheus-registry.module';
import { MediaMetricsPort } from './application/media-metrics.port';
import { MediaMetricsAdapter } from './infrastructure/observability/media-metrics.adapter';

@Module({
  imports: [PrometheusRegistryModule],
  providers: [
    MediaMetricsAdapter,
    { provide: MediaMetricsPort, useExisting: MediaMetricsAdapter },
  ],
  exports: [MediaMetricsPort],
})
export class MediaObservabilityModule {}
