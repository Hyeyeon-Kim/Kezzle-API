import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VitClient } from './vit-client';
import { ClipClient } from './clip-client';
import { PrometheusRegistryModule } from 'src/observability/prometheus/prometheus-registry.module';
import { AiSearchMetricsAdapter } from './ai-search-metrics.adapter';

@Module({
  imports: [HttpModule, PrometheusRegistryModule],
  providers: [VitClient, ClipClient, AiSearchMetricsAdapter],
  exports: [VitClient, ClipClient],
})
export class AiSearchModule {}
