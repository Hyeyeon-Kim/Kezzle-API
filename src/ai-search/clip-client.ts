import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { MetricsService } from 'src/metrics/metrics.service';

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
    private readonly metricsService: MetricsService,
  ) {}

  async koSearch(keyword: string, size: number): Promise<any[]> {
    return this.measure(ENDPOINT_KO_SEARCH, async () => {
      const apiUrl = this.buildUrl('/cakes/ko-search', {
        keyword,
        size,
      });
      const response = await this.httpService.get(apiUrl).toPromise();
      return response.data.result;
    });
  }

  async koSearchPage(
    keyword: string,
    size: number,
    page: number,
  ): Promise<ClipKoSearchPageResult> {
    return this.measure(ENDPOINT_KO_SEARCH_PAGE, async () => {
      const apiUrl = this.buildUrl('/cakes/ko-search-page', {
        keyword,
        size,
        page,
      });
      const response = await this.httpService.get(apiUrl).toPromise();
      return {
        result: response.data.result,
        nextPage: response.data.nextPage,
        isLastPage: response.data.isLastPage,
      };
    });
  }

  private async measure<T>(endpoint: string, fn: () => Promise<T>): Promise<T> {
    const endTimer = this.metricsService.aiApiCallDuration.startTimer({
      model: MODEL,
      endpoint,
    });
    try {
      const result = await fn();
      endTimer({ status: 'success' });
      return result;
    } catch (err) {
      const reason = err?.code === 'ECONNABORTED' ? 'timeout' : 'error';
      endTimer({ status: reason });
      this.metricsService.aiApiErrors.inc({
        reason,
        model: MODEL,
        endpoint,
      });
      throw err;
    }
  }

  private baseUrl(): string {
    return process.env.CLIP_API_BASE_URL ?? 'https://api.kezzlecake.com/clip';
  }

  private buildUrl(
    path: string,
    params: Record<string, string | number>,
  ): string {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      query.set(key, String(value));
    });
    return `${this.baseUrl()}${path}?${query.toString()}`;
  }
}
