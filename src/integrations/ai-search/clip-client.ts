import { Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AiSearchMetricsAdapter } from './ai-search-metrics.adapter';
import { ConfigType } from '@nestjs/config';
import aiConfig from 'src/platform/config/ai.config';

const MODEL = 'clip';
const ENDPOINT_KO_SEARCH = 'ko-search';
const ENDPOINT_KO_SEARCH_PAGE = 'ko-search-page';

export interface ClipKoSearchPageResult {
  result: any[];
  nextPage?: number;
  isLastPage?: boolean;
}

@Injectable()
export class ClipClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly metrics: AiSearchMetricsAdapter,
    @Inject(aiConfig.KEY) private readonly config: ConfigType<typeof aiConfig>,
  ) {}

  async koSearch(
    keyword: string,
    size: number,
    signal?: AbortSignal,
  ): Promise<any[]> {
    return this.measure(ENDPOINT_KO_SEARCH, async () => {
      const apiUrl = this.buildUrl('/cakes/ko-search', {
        keyword,
        size,
      });
      const request = signal
        ? this.httpService.get(apiUrl, { signal })
        : this.httpService.get(apiUrl);
      const response = await request.toPromise();
      return response.data.result;
    });
  }

  async koSearchPage(
    keyword: string,
    size: number,
    page: number,
    signal?: AbortSignal,
  ): Promise<ClipKoSearchPageResult> {
    return this.measure(ENDPOINT_KO_SEARCH_PAGE, async () => {
      const apiUrl = this.buildUrl('/cakes/ko-search-page', {
        keyword,
        size,
        page,
      });
      const request = signal
        ? this.httpService.get(apiUrl, { signal })
        : this.httpService.get(apiUrl);
      const response = await request.toPromise();
      return {
        result: response.data.result,
        nextPage: response.data.nextPage,
        isLastPage: response.data.isLastPage,
      };
    });
  }

  private async measure<T>(endpoint: string, fn: () => Promise<T>): Promise<T> {
    const endCall = this.metrics.startCall({
      model: MODEL,
      endpoint,
    });
    try {
      const result = await fn();
      endCall('success');
      return result;
    } catch (err) {
      const reason = err?.code === 'ECONNABORTED' ? 'timeout' : 'error';
      endCall(reason);
      this.metrics.countError({
        reason,
        model: MODEL,
        endpoint,
      });
      throw err;
    }
  }

  private buildUrl(
    path: string,
    params: Record<string, string | number>,
  ): string {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      query.set(key, String(value));
    });
    return `${this.config.clipBaseUrl}${path}?${query.toString()}`;
  }
}
