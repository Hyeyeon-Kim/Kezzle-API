import { Module } from '@nestjs/common';
import { AiSearchModule } from 'src/integrations/ai-search/ai-search.module';
import { CakeModule } from 'src/modules/cake/cake.module';
import { PrometheusRegistryModule } from 'src/platform/observability/prometheus/prometheus-registry.module';
import { StoreModule } from 'src/modules/store/store.module';
import { CatalogCakeController } from 'src/modules/catalog/api/catalog-cake.controller';
import { CatalogQueryService } from 'src/modules/catalog/application/query/catalog-query.service';
import { CatalogPresenter } from './api/catalog.presenter';
import { CatalogStoreController } from 'src/modules/catalog/api/catalog-store.controller';
import { SimilarCakeCatalogQueryService } from 'src/modules/catalog/application/query/similar-cake-catalog-query.service';
import { LikedStoreCatalogAdapter } from 'src/modules/catalog/infrastructure/integration/like/liked-store-catalog.adapter';
import { LikedStoreCatalogReader } from 'src/modules/catalog/application/port/liked-store-catalog.reader';
import { CatalogMetrics } from 'src/modules/catalog/application/port/catalog-metrics.port';
import { CatalogMetricsAdapter } from 'src/modules/catalog/infrastructure/observability/catalog-metrics.adapter';

@Module({
  imports: [CakeModule, StoreModule, AiSearchModule, PrometheusRegistryModule],
  controllers: [CatalogCakeController, CatalogStoreController],
  providers: [
    CatalogPresenter,
    CatalogQueryService,
    SimilarCakeCatalogQueryService,
    CatalogMetricsAdapter,
    {
      provide: CatalogMetrics,
      useExisting: CatalogMetricsAdapter,
    },
    LikedStoreCatalogAdapter,
    {
      provide: LikedStoreCatalogReader,
      useExisting: LikedStoreCatalogAdapter,
    },
  ],
  exports: [LikedStoreCatalogReader],
})
export class CatalogQueryModule {}
