import { Module } from '@nestjs/common';
import { CurationController } from 'src/curation/api/curation.controller';
import { CurationService } from 'src/curation/application/curation.service';
import {
  Curation,
  CurationSchema,
} from 'src/curation/infrastructure/persistence/schema/curation.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { CurationRefreshService } from 'src/curation/application/refresh/curation-refresh.service';
import { AiSearchModule } from 'src/ai-search/ai-search.module';
import { CurationQueryService } from 'src/curation/application/query/curation-query.service';
import { CurationRepository } from 'src/curation/infrastructure/persistence/curation.repository';
import { PrometheusRegistryModule } from 'src/observability/prometheus/prometheus-registry.module';
import { CurationRefreshMetricsAdapter } from 'src/curation/infrastructure/observability/curation-refresh-metrics.adapter';
import { ConfigModule } from '@nestjs/config';
import curationConfig from 'src/config/curation.config';

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
