import { Module } from '@nestjs/common';
import { LikeService } from './application/like.service';
import { LikeController } from './api/like.controller';
import { CakeModule } from 'src/modules/cake/cake.module';
import { StoreModule } from 'src/modules/store/store.module';
import { UserModule } from 'src/modules/user/user.module';
import { CatalogQueryModule } from 'src/modules/catalog/catalog-query.module';
import { LikePresenter } from './api/like.presenter';
import { LikeEventModule } from './infrastructure/persistence/like-event.module';
import { PrometheusRegistryModule } from 'src/platform/observability/prometheus/prometheus-registry.module';
import { CakeLikeEventMetricsAdapter } from './infrastructure/cake-like-event-metrics.adapter';

@Module({
  imports: [
    CakeModule,
    StoreModule,
    UserModule,
    CatalogQueryModule,
    LikeEventModule,
    PrometheusRegistryModule,
  ],
  providers: [LikeService, LikePresenter, CakeLikeEventMetricsAdapter],
  controllers: [LikeController],
})
export class LikeModule {}
