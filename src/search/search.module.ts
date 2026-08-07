import { Module } from '@nestjs/common';
import { SearchController } from 'src/search/api/search.controller';
import { SearchService } from 'src/search/application/search.service';
import { AiSearchModule } from 'src/ai-search/ai-search.module';
import { PrometheusRegistryModule } from 'src/observability/prometheus/prometheus-registry.module';
import { SearchEventModule } from './infrastructure/persistence/search-event.module';
import { SearchEventMetricsAdapter } from 'src/search/infrastructure/observability/search-event-metrics.adapter';

@Module({
  imports: [AiSearchModule, PrometheusRegistryModule, SearchEventModule],
  controllers: [SearchController],
  providers: [SearchService, SearchEventMetricsAdapter],
  exports: [SearchService],
})
export class SearchModule {}
