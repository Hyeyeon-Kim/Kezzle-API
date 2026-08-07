import { Injectable, Logger } from '@nestjs/common';
import { ClipSearchPort } from 'src/integrations/ai-search/application/clip-search.port';
import { SearchEventRecorder } from 'src/modules/search/application/port/search-event-recorder.port';
import { SearchHistoryReader } from 'src/modules/search/application/port/search-history.reader';
import {
  LatestSearchView,
  SearchResultView,
} from 'src/modules/search/application/search.view';
import { SearchEventMetrics } from 'src/modules/search/application/port/search-event-metrics.port';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly clipClient: ClipSearchPort,
    private readonly searchEventRecorder: SearchEventRecorder,
    private readonly searchHistoryReader: SearchHistoryReader,
    private readonly metrics: SearchEventMetrics,
  ) {}

  async search(
    keywords: string,
    page: number,
    userId: string,
  ): Promise<SearchResultView> {
    if (!keywords) return { cakes: [], hasMore: false };

    const { result, nextPage, isLastPage } = await this.clipClient.koSearchPage(
      keywords,
      18,
      page,
    );

    if (page === 0 || page === undefined) {
      const keywordArr = keywords.split(',').map((keyword) => keyword.trim());
      for (let i = 0; i < keywordArr.length; i++) {
        const word = keywordArr[i];
        const arr = [...keywordArr.slice(0, i), ...keywordArr.slice(i + 1)];
        void this.searchEventRecorder
          .record(userId, word, arr)
          .catch((error: unknown) => this.reportRecordFailure(error));
      }
    }

    return {
      cakes: result,
      nextPage,
      hasMore: !isLastPage,
    };
  }

  async getLatest(userId: string): Promise<LatestSearchView> {
    const latest = await this.searchHistoryReader.findLatest(userId);
    const keyword = new Set<string>();
    for (const entry of latest.slice(0, 10)) {
      if (entry?.searchWord) keyword.add(entry.searchWord);
    }

    const result = Array.from(keyword);
    return { keywords: result };
  }

  private reportRecordFailure(error: unknown): void {
    this.metrics.countRecordFailure();
    this.logger.error({
      event: 'search_event_record_failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
