import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KeywordRankingSourceReader } from 'src/modules/ranking/application/port/keyword-ranking-source.reader';
import { PopularRankingSourceReader } from 'src/modules/ranking/application/port/popular-ranking-source.reader';
import {
  KeywordRank,
  KeywordRankSchema,
} from './infrastructure/persistence/keyword-rank.schema';
import {
  PopularCakeRank,
  PopularCakeRankSchema,
} from './infrastructure/persistence/popular-cake-rank.schema';
import { KeywordRankService } from 'src/modules/ranking/infrastructure/persistence/read-model/keyword-rank.service';
import { MongoPopularRankingSourceAdapter } from './infrastructure/persistence/mongo-popular-ranking-source.adapter';
import { MongoKeywordRankingSourceAdapter } from './infrastructure/persistence/mongo-keyword-ranking-source.adapter';
import { PopularRankService } from 'src/modules/ranking/infrastructure/persistence/read-model/popular-rank.service';
import { RankingController } from 'src/modules/ranking/api/ranking.controller';
import { RankingQueryService } from 'src/modules/ranking/application/query/ranking-query.service';
import { ConfigModule } from '@nestjs/config';
import rankingConfig from 'src/platform/config/ranking.config';
import { KeywordRankReadModelPort } from './application/port/keyword-rank-read-model.port';
import { PopularRankReadModelPort } from './application/port/popular-rank-read-model.port';

@Module({
  imports: [
    ConfigModule.forFeature(rankingConfig),
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
    MongoKeywordRankingSourceAdapter,
    {
      provide: KeywordRankingSourceReader,
      useExisting: MongoKeywordRankingSourceAdapter,
    },
    {
      provide: PopularRankingSourceReader,
      useExisting: MongoPopularRankingSourceAdapter,
    },
    {
      provide: KeywordRankReadModelPort,
      useExisting: KeywordRankService,
    },
    {
      provide: PopularRankReadModelPort,
      useExisting: PopularRankService,
    },
  ],
  exports: [RankingQueryService],
})
export class RankingModule {}
