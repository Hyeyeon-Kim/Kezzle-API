import { Module } from '@nestjs/common';
import { AiSearchModule } from 'src/ai-search/ai-search.module';
import { CakeModule } from 'src/cake/cake.module';
import { PrometheusRegistryModule } from 'src/observability/prometheus/prometheus-registry.module';
import { StoreModule } from 'src/store/store.module';
import { CatalogCakeController } from 'src/catalog/api/catalog-cake.controller';
import { CatalogQueryService } from 'src/catalog/application/query/catalog-query.service';
import { CatalogPresenter } from './api/catalog.presenter';
import { CatalogStoreController } from 'src/catalog/api/catalog-store.controller';
import { SimilarCakeCatalogQueryService } from 'src/catalog/application/query/similar-cake-catalog-query.service';
import { LikedStoreCatalogAdapter } from 'src/catalog/infrastructure/integration/like/liked-store-catalog.adapter';
import { LikedStoreCatalogReader } from 'src/catalog/application/port/liked-store-catalog.reader';
import { CatalogMetricsAdapter } from 'src/catalog/infrastructure/observability/catalog-metrics.adapter';

@Module({
  imports: [CakeModule, StoreModule, AiSearchModule, PrometheusRegistryModule],
  controllers: [CatalogCakeController, CatalogStoreController],
  providers: [
    CatalogPresenter,
    CatalogQueryService,
    SimilarCakeCatalogQueryService,
    CatalogMetricsAdapter,
    LikedStoreCatalogAdapter,
    {
      provide: LikedStoreCatalogReader,
      useExisting: LikedStoreCatalogAdapter,
    },
  ],
  exports: [LikedStoreCatalogReader],
})
export class CatalogQueryModule {}
