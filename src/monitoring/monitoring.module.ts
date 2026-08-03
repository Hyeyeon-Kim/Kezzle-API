import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { PrometheusRegistryModule } from 'src/observability/prometheus/prometheus-registry.module';

@Module({
  imports: [PrometheusRegistryModule],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
