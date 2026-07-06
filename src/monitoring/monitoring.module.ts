import { Global, Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { MetricsModule } from 'src/metrics/metrics.module';

// registry와 metric 객체를 앱 전체에서 한 곳에서만 생성한다.
@Global()
@Module({
  imports: [MetricsModule],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
