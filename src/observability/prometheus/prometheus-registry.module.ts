import { Module } from '@nestjs/common';
import { PROMETHEUS_REGISTRY } from './prometheus.constants';
import { prometheusRegistryProvider } from './prometheus-registry.provider';

@Module({
  providers: [prometheusRegistryProvider],
  exports: [PROMETHEUS_REGISTRY],
})
export class PrometheusRegistryModule {}
