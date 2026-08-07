import { Module } from '@nestjs/common';
import { SearchController } from 'src/modules/search/api/search.controller';
import { SearchService } from 'src/modules/search/application/search.service';
import { AiSearchModule } from 'src/integrations/ai-search/ai-search.module';
import { PrometheusRegistryModule } from 'src/platform/observability/prometheus/prometheus-registry.module';
import { SearchEventModule } from './infrastructure/persistence/search-event.module';
import { SearchEventMetrics } from 'src/modules/search/application/port/search-event-metrics.port';
import { SearchEventMetricsAdapter } from 'src/modules/search/infrastructure/observability/search-event-metrics.adapter';

@Module({
  imports: [AiSearchModule, PrometheusRegistryModule, SearchEventModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    SearchEventMetricsAdapter,
    {
      provide: SearchEventMetrics,
      useExisting: SearchEventMetricsAdapter,
    },
  ],
})
export class SearchModule {}
