import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { KeywordEventReader } from '../../application/port/keyword-event.reader';
import { SearchEventRecorder } from '../../application/port/search-event-recorder.port';
import {
  SearchHistoryEntry,
  SearchHistoryReader,
} from '../../application/port/search-history.reader';
import { KeywordLog } from './search-event.schema';

@Injectable()
export class SearchEventRepository
  implements SearchEventRecorder, SearchHistoryReader, KeywordEventReader
{
  constructor(
    @InjectModel(KeywordLog.name, 'kezzle')
    private readonly keywordModel: Model<KeywordLog>,
  ) {}

  async record(
    userId: string,
    searchWord: string,
    relatedWord: string[],
  ): Promise<void> {
    await this.keywordModel.create({ userId, searchWord, relatedWord });
  }

  async findLatest(userId: string): Promise<SearchHistoryEntry[]> {
    return this.keywordModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
  }

  async getRanked(
    startDateStr: string,
    endDateStr: string,
    limit: number = 10,
    maxTimeMs?: number,
  ) {
    const match: PipelineStage.Match = {
      $match: {
        createdAt: {
          $gte: new Date(startDateStr),
          $lte: new Date(endDateStr),
        },
      },
    };
    const group: PipelineStage.Group = {
      $group: {
        _id: '$searchWord',
        count: { $sum: 1 },
      },
    };
    const sort: PipelineStage.Sort = {
      $sort: { count: -1, _id: 1 },
    };

    const aggregate = this.keywordModel
      .aggregate([match, group, sort])
      .limit(limit);
    if (maxTimeMs !== undefined) {
      aggregate.option({ maxTimeMS: maxTimeMs });
    }
    return aggregate;
  }
}
