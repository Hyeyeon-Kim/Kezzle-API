import { Module } from '@nestjs/common';
import { LikeService } from './like.service';
import { LikeController } from './like.controller';
import { LogModule } from 'src/log/log.module';
import { CakeModule } from 'src/cake/cake.module';
import { StoreModule } from 'src/store/store.module';
import { UserModule } from 'src/user/user.module';
import { CatalogQueryModule } from 'src/catalog/catalog-query.module';
import { LikePresenter } from './api/like.presenter';

@Module({
  imports: [CakeModule, StoreModule, UserModule, CatalogQueryModule, LogModule],
  providers: [LikeService, LikePresenter],
  controllers: [LikeController],
})
export class LikeModule {}
