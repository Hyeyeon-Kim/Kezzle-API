import { Module } from '@nestjs/common';
import { AnniversaryModule } from 'src/anniversary/anniversary.module';
import { CakeModule } from 'src/cake/cake.module';
import { CurationModule } from 'src/curation/curation.module';
import { RankingModule } from 'src/ranking/ranking.module';
import { HomeController } from './api/home.controller';
import { HomePresenter } from './api/home.presenter';
import { HomeFeedService } from './application/home-feed.service';
import { HomeSectionLoader } from './application/home-section.loader';
import { HomeCacheModule } from './infrastructure/cache/home-cache.module';
import { HomeObservabilityModule } from './infrastructure/observability/home-observability.module';
import { ConfigModule } from '@nestjs/config';
import homeConfig from 'src/config/home.config';

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
  providers: [HomeFeedService, HomeSectionLoader, HomePresenter],
})
export class HomeModule {}
