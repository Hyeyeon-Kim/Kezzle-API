import { Module } from '@nestjs/common';
import { PopularRankService } from './popular-rank.service';
import { KeywordRankService } from './keyword-rank.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PopularCakeRank,
  PopularCakeRankSchema,
} from './entities/popularCakeRank.shema';
import { KeywordRank, KeywordRankSchema } from './entities/keywordRank.shema';
import { SearchEventModule } from 'src/search/infrastructure/persistence/search-event.module';
import { LikeEventModule } from 'src/like/infrastructure/persistence/like-event.module';
import { CakeRankingModule } from 'src/cake/cake-ranking.module';

@Module({
  imports: [
    SearchEventModule,
    LikeEventModule,
    CakeRankingModule,
    MongooseModule.forFeature(
      [{ name: PopularCakeRank.name, schema: PopularCakeRankSchema }],
      'kezzle',
    ),
    MongooseModule.forFeature(
      [{ name: KeywordRank.name, schema: KeywordRankSchema }],
      'kezzle',
    ),
  ],
  providers: [PopularRankService, KeywordRankService],
  exports: [PopularRankService, KeywordRankService],
})
export class LogModule {}
