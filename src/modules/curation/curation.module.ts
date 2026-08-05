import { Module } from '@nestjs/common';
import { CurationController } from './curation.controller';
import { CurationService } from './curation.service';
import { Curation, CurationSchema } from './entities/curation.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { CurationRefreshService } from './curation-refresh.service';
import { AiSearchModule } from 'src/integrations/ai-search/ai-search.module';
import { CurationQueryService } from './curation-query.service';
import { CurationRepository } from './curation.repository';
import { PrometheusRegistryModule } from 'src/platform/observability/prometheus/prometheus-registry.module';
import { CurationRefreshMetricsAdapter } from './curation-refresh-metrics.adapter';
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
