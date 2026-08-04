import { Module } from '@nestjs/common';
import { AnniversaryModule } from 'src/anniversary/anniversary.module';
import { CakeModule } from 'src/cake/cake.module';
import { CurationModule } from 'src/curation/curation.module';
import { HomeCacheModule } from 'src/home-cache/home-cache.module';
import { RankingModule } from 'src/ranking/ranking.module';
import { HomeController } from './home.controller';
import { HomeFeedService } from './home-feed.service';
import { HomePresenter } from './api/home.presenter';
import { HomeObservabilityModule } from './observability/home-observability.module';

@Module({
  imports: [
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
