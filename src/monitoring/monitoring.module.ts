import { Global, Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { PrometheusRegistryModule } from 'src/observability/prometheus/prometheus-registry.module';

// Phase B compatibility provider. @Global() 제거와 explicit import 전환은
// Phase C에서 consumer module 단위로 수행한다.
@Global()
@Module({
  imports: [PrometheusRegistryModule],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
