import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { AiSearchModule } from 'src/integrations/ai-search/ai-search.module';
import { PrometheusRegistryModule } from 'src/platform/observability/prometheus/prometheus-registry.module';
import { SearchEventModule } from './infrastructure/persistence/search-event.module';
import { SearchEventMetricsAdapter } from './search-event-metrics.adapter';

@Module({
  imports: [AiSearchModule, PrometheusRegistryModule, SearchEventModule],
  controllers: [SearchController],
  providers: [SearchService, SearchEventMetricsAdapter],
  exports: [SearchService],
})
export class SearchModule {}
