import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { LogModule } from 'src/log/log.module';
import { AiSearchModule } from 'src/ai-search/ai-search.module';

@Module({
  imports: [LogModule, AiSearchModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
