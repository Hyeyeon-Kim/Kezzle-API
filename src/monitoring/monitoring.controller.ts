import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { MonitoringService } from './monitoring.service';
import { MetricsService } from 'src/metrics/metrics.service';
import { Public } from 'src/auth/decorators/public.decorator';

// Prometheus scrape 전용 endpoint.
// Docker 내부 network에서 인증 없이 접근해야 하므로 Firebase/role guard를 적용하지 않는다.
// 운영 노출 시 LB/security group에서 내부 접근만 허용해야 한다.
@ApiExcludeController()
@Controller('metrics')
export class MonitoringController {
  constructor(
    private readonly monitoring: MonitoringService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get()
  @Public()
  @Header('Cache-Control', 'no-store')
  async metrics(@Res() response: Response): Promise<void> {
    response.setHeader('Content-Type', this.monitoring.contentType());
    const [homeMetrics, sharedMetrics] = await Promise.all([
      this.monitoring.metrics(),
      this.metricsService.registry.metrics(),
    ]);
    response.send(`${homeMetrics}\n${sharedMetrics}`);
  }
}
