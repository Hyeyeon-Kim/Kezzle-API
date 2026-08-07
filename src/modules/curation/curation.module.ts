import { Module } from '@nestjs/common';
import { CurationController } from 'src/modules/curation/api/curation.controller';
import { CurationService } from 'src/modules/curation/application/curation.service';
import {
  Curation,
  CurationSchema,
} from 'src/modules/curation/infrastructure/persistence/schema/curation.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { CurationRefreshService } from 'src/modules/curation/application/refresh/curation-refresh.service';
import { AiSearchModule } from 'src/integrations/ai-search/ai-search.module';
import { CurationQueryService } from 'src/modules/curation/application/query/curation-query.service';
import { CurationRepository } from 'src/modules/curation/application/port/curation-repository.port';
import { MongooseCurationRepository } from 'src/modules/curation/infrastructure/persistence/curation.repository';
import { PrometheusRegistryModule } from 'src/platform/observability/prometheus/prometheus-registry.module';
import { CurationRefreshMetricsAdapter } from 'src/modules/curation/infrastructure/observability/curation-refresh-metrics.adapter';
import { CurationRefreshMetrics } from 'src/modules/curation/application/port/curation-refresh-metrics.port';
import { ConfigModule } from '@nestjs/config';
import curationConfig from 'src/platform/config/curation.config';
import { CurationRefreshJob } from 'src/modules/curation/infrastructure/scheduling/curation-refresh.job';
import { curationRefreshPolicyProvider } from 'src/modules/curation/infrastructure/scheduling/curation-refresh-policy.provider';

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
    MongooseCurationRepository,
    {
      provide: CurationRepository,
      useExisting: MongooseCurationRepository,
    },
    CurationService,
    CurationQueryService,
    CurationRefreshMetricsAdapter,
    {
      provide: CurationRefreshMetrics,
      useExisting: CurationRefreshMetricsAdapter,
    },
    CurationRefreshService,
    curationRefreshPolicyProvider,
    CurationRefreshJob,
  ],
  exports: [CurationQueryService],
})
export class CurationModule {}
