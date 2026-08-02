import { Module } from '@nestjs/common';
import { LikeService } from './like.service';
import { LikeController } from './like.controller';
import { CakeModule } from 'src/cake/cake.module';
import { StoreModule } from 'src/store/store.module';
import { UserModule } from 'src/user/user.module';
import { CatalogQueryModule } from 'src/catalog/catalog-query.module';
import { LikePresenter } from './api/like.presenter';
import { LikeEventModule } from './infrastructure/persistence/like-event.module';
import { MetricsModule } from 'src/metrics/metrics.module';

@Module({
  imports: [
    CakeModule,
    StoreModule,
    UserModule,
    CatalogQueryModule,
    LikeEventModule,
    MetricsModule,
  ],
  providers: [LikeService, LikePresenter],
  controllers: [LikeController],
})
export class LikeModule {}
