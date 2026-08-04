import { Provider } from '@nestjs/common';
import { collectDefaultMetrics, Registry } from 'prom-client';
import { PROMETHEUS_REGISTRY } from './prometheus.constants';

export function createPrometheusRegistry(): Registry {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: 'kezzle_' });
  return registry;
}

export const prometheusRegistryProvider: Provider<Registry> = {
  provide: PROMETHEUS_REGISTRY,
  useFactory: createPrometheusRegistry,
};
