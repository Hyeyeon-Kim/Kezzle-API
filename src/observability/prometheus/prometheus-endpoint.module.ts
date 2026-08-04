import { Module } from '@nestjs/common';
import { PrometheusRegistryModule } from './prometheus-registry.module';
import { PrometheusController } from './prometheus.controller';

@Module({
  imports: [PrometheusRegistryModule],
  controllers: [PrometheusController],
})
export class PrometheusEndpointModule {}
