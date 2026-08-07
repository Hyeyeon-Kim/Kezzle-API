import { AiSearchCakeResult } from './ai-search-result';

export abstract class VitSearchPort {
  abstract similarSearch(
    id: string,
    size: number,
    signal?: AbortSignal,
  ): Promise<AiSearchCakeResult[]>;

  abstract similarSearchWithLocation(
    id: string,
    lon: number,
    lat: number,
    dist: number,
    size: number,
    signal?: AbortSignal,
  ): Promise<AiSearchCakeResult[]>;
}
