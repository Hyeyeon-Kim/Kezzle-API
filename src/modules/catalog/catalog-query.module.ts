import { Module } from '@nestjs/common';
import { AiSearchModule } from 'src/integrations/ai-search/ai-search.module';
import { CakeModule } from 'src/modules/cake/cake.module';
import { PrometheusRegistryModule } from 'src/platform/observability/prometheus/prometheus-registry.module';
import { StoreModule } from 'src/modules/store/store.module';
import { CatalogCakeController } from './catalog-cake.controller';
import { CatalogQueryService } from './catalog-query.service';
import { CatalogPresenter } from './api/catalog.presenter';
import { CatalogStoreController } from './catalog-store.controller';
import { SimilarCakeCatalogQueryService } from './similar-cake-catalog-query.service';
import { LikedStoreCatalogAdapter } from './liked-store-catalog.adapter';
import { LikedStoreCatalogReader } from './liked-store-catalog.reader';
import { CatalogMetricsAdapter } from './catalog-metrics.adapter';

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
