import { Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigType } from '@nestjs/config';
import aiConfig from 'src/platform/config/ai.config';
import { AiSearchMetricsPort } from '../../application/ai-search-metrics.port';
import { AiSearchCakeResult } from '../../application/ai-search-result';
import { VitSearchPort } from '../../application/vit-search.port';
import {
  AiSearchResultMapper,
  ExternalAiSearchCakeResult,
} from './ai-search-result.mapper';

const MODEL = 'vit';
const ENDPOINT_SIMILAR_SEARCH = 'similar-search';

@Injectable()
export class VitHttpAdapter implements VitSearchPort {
  constructor(
    private readonly httpService: HttpService,
    private readonly metrics: AiSearchMetricsPort,
    @Inject(aiConfig.KEY) private readonly config: ConfigType<typeof aiConfig>,
  ) {}

  async similarSearch(
    id: string,
    size: number,
    signal?: AbortSignal,
  ): Promise<AiSearchCakeResult[]> {
    return this.measure(ENDPOINT_SIMILAR_SEARCH, async () => {
      const apiUrl = this.buildUrl('/cakes/similar-search', {
        id,
        size,
      });
      const request = signal
        ? this.httpService.get<{ result: ExternalAiSearchCakeResult[] }>(
            apiUrl,
            { signal },
          )
        : this.httpService.get<{ result: ExternalAiSearchCakeResult[] }>(
            apiUrl,
          );
      const response = await request.toPromise();
      return response.data.result.map((cake) =>
        AiSearchResultMapper.toApplication(cake),
      );
    });
  }

  async similarSearchWithLocation(
    id: string,
    lon: number,
    lat: number,
    dist: number,
    size: number,
    signal?: AbortSignal,
  ): Promise<AiSearchCakeResult[]> {
    return this.measure(ENDPOINT_SIMILAR_SEARCH, async () => {
      const apiUrl = this.buildUrl('/cakes/similar-search', {
        id,
        lon,
        lat,
        dist,
        size,
      });
      const request = signal
        ? this.httpService.get<{ result: ExternalAiSearchCakeResult[] }>(
            apiUrl,
            { signal },
          )
        : this.httpService.get<{ result: ExternalAiSearchCakeResult[] }>(
            apiUrl,
          );
      const response = await request.toPromise();
      return response.data.result.map((cake) =>
        AiSearchResultMapper.toApplication(cake),
      );
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
    return `${this.config.vitBaseUrl}${path}?${query.toString()}`;
  }
}
