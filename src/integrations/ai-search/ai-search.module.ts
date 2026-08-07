import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrometheusRegistryModule } from 'src/platform/observability/prometheus/prometheus-registry.module';
import { ConfigModule, ConfigType } from '@nestjs/config';
import aiConfig from 'src/platform/config/ai.config';
import { AiSearchMetricsPort } from './application/ai-search-metrics.port';
import { ClipSearchPort } from './application/clip-search.port';
import { VitSearchPort } from './application/vit-search.port';
import { ClipHttpAdapter } from './infrastructure/http/clip-http.adapter';
import { VitHttpAdapter } from './infrastructure/http/vit-http.adapter';
import { AiSearchMetricsAdapter } from './infrastructure/observability/ai-search-metrics.adapter';

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
  providers: [
    VitHttpAdapter,
    ClipHttpAdapter,
    AiSearchMetricsAdapter,
    { provide: VitSearchPort, useExisting: VitHttpAdapter },
    { provide: ClipSearchPort, useExisting: ClipHttpAdapter },
    { provide: AiSearchMetricsPort, useExisting: AiSearchMetricsAdapter },
  ],
  exports: [VitSearchPort, ClipSearchPort],
})
export class AiSearchModule {}
