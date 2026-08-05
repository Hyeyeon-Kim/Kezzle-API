import { Module } from '@nestjs/common';
import { CurationController } from './api/curation.controller';
import { CurationService } from './application/curation.service';
import {
  Curation,
  CurationSchema,
} from './infrastructure/persistence/entities/curation.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { CurationRefreshService } from './application/curation-refresh.service';
import { AiSearchModule } from 'src/integrations/ai-search/ai-search.module';
import { CurationQueryService } from './application/curation-query.service';
import { CurationRepository } from './infrastructure/persistence/curation.repository';
import { PrometheusRegistryModule } from 'src/platform/observability/prometheus/prometheus-registry.module';
import { CurationRefreshMetricsAdapter } from './infrastructure/curation-refresh-metrics.adapter';
import { ConfigModule } from '@nestjs/config';
import curationConfig from 'src/platform/config/curation.config';

@Module({
  imports: [
    ConfigModule.forFeature(curationConfig),
    MongooseModule.forFeature(
      [{ name: Curation.name, schema: CurationSchema }],
      'kezzle',
    ),
    AiSearchModule,
    PrometheusRegistryModule,
  ],
  controllers: [CurationController],
  providers: [
    CurationRepository,
    CurationService,
    CurationQueryService,
    CurationRefreshMetricsAdapter,
    CurationRefreshService,
  ],
  exports: [CurationQueryService],
})
export class CurationModule {}
