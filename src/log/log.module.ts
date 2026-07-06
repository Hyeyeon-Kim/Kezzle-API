import { Module } from '@nestjs/common';
import { LogService } from './log.service';
import { PopularRankService } from './popular-rank.service';
import { KeywordRankService } from './keyword-rank.service';
import { MongooseModule } from '@nestjs/mongoose';
import { KeywordLog, KeywordLogSchema } from './entities/keywordLog.shema';
import { CakeLikeLog, CakeLikeLogSchema } from './entities/cakeLikeLog.shema';
import {
  PopularCakeRank,
  PopularCakeRankSchema,
} from './entities/popularCakeRank.shema';
import { KeywordRank, KeywordRankSchema } from './entities/keywordRank.shema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: KeywordLog.name, schema: KeywordLogSchema }],
      'kezzle',
    ),
    MongooseModule.forFeature(
      [{ name: CakeLikeLog.name, schema: CakeLikeLogSchema }],
      'kezzle',
    ),
    MongooseModule.forFeature(
      [{ name: PopularCakeRank.name, schema: PopularCakeRankSchema }],
      'kezzle',
    ),
    MongooseModule.forFeature(
      [{ name: KeywordRank.name, schema: KeywordRankSchema }],
      'kezzle',
    ),
  ],
  providers: [LogService, PopularRankService, KeywordRankService],
  exports: [LogService, PopularRankService, KeywordRankService],
})
export class LogModule {}
