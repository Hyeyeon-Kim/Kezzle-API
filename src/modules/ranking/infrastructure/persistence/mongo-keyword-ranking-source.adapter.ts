import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, PipelineStage } from 'mongoose';
import {
  KeywordRankingCount,
  KeywordRankingSourceReader,
} from 'src/modules/ranking/application/port/keyword-ranking-source.reader';

const EVENT_COLLECTION = 'keywordlogs';

@Injectable()
export class MongoKeywordRankingSourceAdapter
  implements KeywordRankingSourceReader
{
  constructor(
    @InjectConnection('kezzle') private readonly connection: Connection,
  ) {}

  async getRanked(
    startDate: string,
    endDate: string,
    limit: number = 10,
    maxTimeMs?: number,
  ): Promise<KeywordRankingCount[]> {
    const pipeline: PipelineStage[] = [
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        },
      },
      {
        $group: {
          _id: '$searchWord',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: limit },
    ];

    const collection = this.connection.collection(EVENT_COLLECTION);
    const cursor =
      maxTimeMs === undefined
        ? collection.aggregate<KeywordRankingCount>(pipeline)
        : collection.aggregate<KeywordRankingCount>(pipeline, {
            maxTimeMS: maxTimeMs,
          });

    return cursor.toArray();
  }
}
