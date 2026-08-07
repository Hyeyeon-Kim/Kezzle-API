import { Module } from '@nestjs/common';
import { LikeService } from 'src/modules/like/application/like.service';
import { LikeController } from 'src/modules/like/api/like.controller';
import { CakeModule } from 'src/modules/cake/cake.module';
import { StoreModule } from 'src/modules/store/store.module';
import { UserModule } from 'src/modules/user/user.module';
import { CatalogQueryModule } from 'src/modules/catalog/catalog-query.module';
import { LikePresenter } from './api/like.presenter';
import { LikeEventModule } from './infrastructure/persistence/like-event.module';
import { PrometheusRegistryModule } from 'src/platform/observability/prometheus/prometheus-registry.module';
import { CakeLikeEventMetrics } from 'src/modules/like/application/port/cake-like-event-metrics.port';
import { CakeLikeEventMetricsAdapter } from 'src/modules/like/infrastructure/observability/cake-like-event-metrics.adapter';

@Module({
  imports: [
    CakeModule,
    StoreModule,
    UserModule,
    CatalogQueryModule,
    LikeEventModule,
    PrometheusRegistryModule,
  ],
  providers: [
    LikeService,
    LikePresenter,
    CakeLikeEventMetricsAdapter,
    {
      provide: CakeLikeEventMetrics,
      useExisting: CakeLikeEventMetricsAdapter,
    },
  ],
  controllers: [LikeController],
})
export class LikeModule {}
