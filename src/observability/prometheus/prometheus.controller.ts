import { Controller, Get, Header, Inject, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { Registry } from 'prom-client';
import { Public } from 'src/auth/decorators/public.decorator';
import { PROMETHEUS_REGISTRY } from './prometheus.constants';

// Prometheus scrape 전용 endpoint.
// Docker 내부 network에서 인증 없이 접근해야 하므로 Firebase/role guard를 적용하지 않는다.
// 운영 노출 시 LB/security group에서 내부 접근만 허용해야 한다.
@ApiExcludeController()
@Controller('metrics')
export class PrometheusController {
  constructor(
    @Inject(PROMETHEUS_REGISTRY)
    private readonly registry: Registry,
  ) {}

  @Get()
  @Public()
  @Header('Cache-Control', 'no-store')
  async metrics(@Res() response: Response): Promise<void> {
    response.setHeader('Content-Type', this.registry.contentType);
    response.send(await this.registry.metrics());
  }
}
