import { Module } from '@nestjs/common';
import { LikeService } from 'src/like/application/like.service';
import { LikeController } from 'src/like/api/like.controller';
import { CakeModule } from 'src/cake/cake.module';
import { StoreModule } from 'src/store/store.module';
import { UserModule } from 'src/user/user.module';
import { CatalogQueryModule } from 'src/catalog/catalog-query.module';
import { LikePresenter } from './api/like.presenter';
import { LikeEventModule } from './infrastructure/persistence/like-event.module';
import { PrometheusRegistryModule } from 'src/observability/prometheus/prometheus-registry.module';
import { CakeLikeEventMetricsAdapter } from 'src/like/infrastructure/observability/cake-like-event-metrics.adapter';

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
