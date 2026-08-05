import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VitClient } from './vit-client';
import { ClipClient } from './clip-client';
import { PrometheusRegistryModule } from 'src/platform/observability/prometheus/prometheus-registry.module';
import { AiSearchMetricsAdapter } from './ai-search-metrics.adapter';
import { ConfigModule, ConfigType } from '@nestjs/config';
import aiConfig from 'src/platform/config/ai.config';

@Module({
  imports: [
    ConfigModule.forFeature(aiConfig),
    HttpModule.registerAsync({
      imports: [ConfigModule.forFeature(aiConfig)],
      inject: [aiConfig.KEY],
      useFactory: (config: ConfigType<typeof aiConfig>) => ({
        timeout: config.httpTimeoutMs,
      }),
    }),
    PrometheusRegistryModule,
  ],
  providers: [VitClient, ClipClient, AiSearchMetricsAdapter],
  exports: [VitClient, ClipClient],
})
export class AiSearchModule {}
