import { Module } from '@nestjs/common';
import { AnniversaryModule } from 'src/modules/anniversary/anniversary.module';
import { CakeModule } from 'src/modules/cake/cake.module';
import { CurationModule } from 'src/modules/curation/curation.module';
import { HomeCacheModule } from 'src/modules/home/infrastructure/cache/home-cache.module';
import { RankingModule } from 'src/modules/ranking/ranking.module';
import { HomeController } from './home.controller';
import { HomeFeedService } from './home-feed.service';
import { HomePresenter } from './api/home.presenter';
import { HomeObservabilityModule } from './observability/home-observability.module';
import { ConfigModule } from '@nestjs/config';
import homeConfig from 'src/platform/config/home.config';

@Module({
  imports: [
    ConfigModule.forFeature(homeConfig),
    CakeModule,
    AnniversaryModule,
    RankingModule,
    CurationModule,
    HomeCacheModule,
    HomeObservabilityModule,
  ],
  controllers: [HomeController],
  providers: [HomeFeedService, HomePresenter],
})
export class HomeModule {}
