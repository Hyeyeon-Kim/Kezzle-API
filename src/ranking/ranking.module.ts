import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchEventModule } from 'src/search/infrastructure/persistence/search-event.module';
import { PopularRankingSourceReader } from './application/popular-ranking-source.reader';
import {
  KeywordRank,
  KeywordRankSchema,
} from './infrastructure/persistence/keyword-rank.schema';
import {
  PopularCakeRank,
  PopularCakeRankSchema,
} from './infrastructure/persistence/popular-cake-rank.schema';
import { KeywordRankService } from './keyword-rank.service';
import { MongoPopularRankingSourceAdapter } from './infrastructure/persistence/mongo-popular-ranking-source.adapter';
import { PopularRankService } from './popular-rank.service';
import { RankingController } from './ranking.controller';
import { RankingQueryService } from './ranking-query.service';
import { ConfigModule } from '@nestjs/config';
import rankingConfig from 'src/config/ranking.config';

@Module({
  imports: [
    ConfigModule.forFeature(rankingConfig),
    SearchEventModule,
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
  providers: [
    KeywordRankService,
    PopularRankService,
    RankingQueryService,
    MongoPopularRankingSourceAdapter,
    {
      provide: PopularRankingSourceReader,
      useExisting: MongoPopularRankingSourceAdapter,
    },
  ],
  exports: [RankingQueryService],
})
export class RankingModule {}
