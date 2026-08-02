import { Module } from '@nestjs/common';
import { AnniversaryModule } from 'src/anniversary/anniversary.module';
import { CakeModule } from 'src/cake/cake.module';
import { CurationModule } from 'src/curation/curation.module';
import { HomeCacheModule } from 'src/home-cache/home-cache.module';
import { HomeResilienceMetricsModule } from 'src/home-resilience/home-resilience-metrics.module';
import { MonitoringModule } from 'src/monitoring/monitoring.module';
import { RankingModule } from 'src/ranking/ranking.module';
import { HomeController } from './home.controller';
import { HomeFeedService } from './home-feed.service';
import { HomePresenter } from './api/home.presenter';

@Module({
  imports: [
    CakeModule,
    AnniversaryModule,
    RankingModule,
    CurationModule,
    HomeCacheModule,
    HomeResilienceMetricsModule,
    MonitoringModule,
  ],
  controllers: [HomeController],
  providers: [HomeFeedService, HomePresenter],
})
export class HomeModule {}
