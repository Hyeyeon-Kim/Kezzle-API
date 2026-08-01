import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CakeRankingModule } from 'src/cake/cake-ranking.module';
import { LikeEventModule } from 'src/like/infrastructure/persistence/like-event.module';
import { SearchEventModule } from 'src/search/infrastructure/persistence/search-event.module';
import {
  KeywordRank,
  KeywordRankSchema,
} from './infrastructure/persistence/keyword-rank.schema';
import {
  PopularCakeRank,
  PopularCakeRankSchema,
} from './infrastructure/persistence/popular-cake-rank.schema';
import { KeywordRankService } from './keyword-rank.service';
import { PopularRankService } from './popular-rank.service';
import { RankingController } from './ranking.controller';
import { RankingQueryService } from './ranking-query.service';

@Module({
  imports: [
    SearchEventModule,
    LikeEventModule,
    CakeRankingModule,
    MongooseModule.forFeature(
      [{ name: KeywordRank.name, schema: KeywordRankSchema }],
      'kezzle',
    ),
    MongooseModule.forFeature(
      [{ name: PopularCakeRank.name, schema: PopularCakeRankSchema }],
      'kezzle',
    ),
  ],
  controllers: [RankingController],
  providers: [KeywordRankService, PopularRankService, RankingQueryService],
  exports: [RankingQueryService],
})
export class RankingModule {}
