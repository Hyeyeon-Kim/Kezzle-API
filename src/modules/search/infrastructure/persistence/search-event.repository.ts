import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SearchEventRecorder } from '../../application/port/search-event-recorder.port';
import {
  SearchHistoryEntry,
  SearchHistoryReader,
} from '../../application/port/search-history.reader';
import { KeywordLog } from './search-event.schema';

@Injectable()
export class SearchEventRepository
  implements SearchEventRecorder, SearchHistoryReader
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
}
