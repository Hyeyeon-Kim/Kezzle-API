import { Module } from '@nestjs/common';
import { AiSearchModule } from 'src/ai-search/ai-search.module';
import { CakeModule } from 'src/cake/cake.module';
import { MetricsModule } from 'src/metrics/metrics.module';
import { StoreModule } from 'src/store/store.module';
import { CatalogCakeController } from './catalog-cake.controller';
import { CatalogQueryService } from './catalog-query.service';
import { CatalogPresenter } from './catalog.presenter';
import { CatalogStoreController } from './catalog-store.controller';
import { SimilarCakeCatalogQueryService } from './similar-cake-catalog-query.service';

@Module({
  imports: [CakeModule, StoreModule, AiSearchModule, MetricsModule],
  controllers: [CatalogCakeController, CatalogStoreController],
  providers: [
    CatalogPresenter,
    CatalogQueryService,
    SimilarCakeCatalogQueryService,
  ],
})
export class CatalogQueryModule {}
