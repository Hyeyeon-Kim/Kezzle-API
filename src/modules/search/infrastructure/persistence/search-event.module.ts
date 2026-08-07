import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchEventRecorder } from '../../application/port/search-event-recorder.port';
import { SearchHistoryReader } from '../../application/port/search-history.reader';
import { SearchEventRepository } from './search-event.repository';
import { KeywordLog, KeywordLogSchema } from './search-event.schema';

const searchEventPorts = [
  { provide: SearchEventRecorder, useExisting: SearchEventRepository },
  { provide: SearchHistoryReader, useExisting: SearchEventRepository },
];

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: KeywordLog.name, schema: KeywordLogSchema }],
      'kezzle',
    ),
  ],
  providers: [SearchEventRepository, ...searchEventPorts],
  exports: [SearchEventRecorder, SearchHistoryReader],
})
export class SearchEventModule {}
