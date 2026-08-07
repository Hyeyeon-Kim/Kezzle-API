import { AiSearchCakePageResult, AiSearchCakeResult } from './ai-search-result';

export abstract class ClipSearchPort {
  abstract koSearch(
    keyword: string,
    size: number,
    signal?: AbortSignal,
  ): Promise<AiSearchCakeResult[]>;

  abstract koSearchPage(
    keyword: string,
    size: number,
    page: number,
    signal?: AbortSignal,
  ): Promise<AiSearchCakePageResult>;
}
