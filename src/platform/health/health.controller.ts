import {
  Controller,
  Get,
  Header,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from 'src/platform/auth/decorators/public.decorator';
import {
  HealthService,
  LivenessResponse,
  ReadinessResponse,
} from './health.service';

@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  @Public()
  @Header('Cache-Control', 'no-store')
  live(): LivenessResponse {
    return this.health.liveness();
  }

  @Get('ready')
  @Public()
  @Header('Cache-Control', 'no-store')
  ready(): ReadinessResponse {
    const result = this.health.readinessStatus();
    if (result.status === 'unavailable') {
      throw new ServiceUnavailableException(result);
    }
    return result;
  }
}
