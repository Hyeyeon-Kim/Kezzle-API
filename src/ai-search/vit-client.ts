import { Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AiSearchMetricsAdapter } from './ai-search-metrics.adapter';
import { ConfigType } from '@nestjs/config';
import aiConfig from 'src/config/ai.config';

const MODEL = 'vit';
const ENDPOINT_SIMILAR_SEARCH = 'similar-search';

@Injectable()
export class VitClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly metrics: AiSearchMetricsAdapter,
    @Inject(aiConfig.KEY) private readonly config: ConfigType<typeof aiConfig>,
  ) {}

  async similarSearch(
    id: string,
    size: number,
    signal?: AbortSignal,
  ): Promise<any[]> {
    return this.measure(ENDPOINT_SIMILAR_SEARCH, async () => {
      const apiUrl = this.buildUrl('/cakes/similar-search', {
        id,
        size,
      });
      const request = signal
        ? this.httpService.get(apiUrl, { signal })
        : this.httpService.get(apiUrl);
      const response = await request.toPromise();
      return response.data.result;
    });
  }

  async similarSearchWithLocation(
    id: string,
    lon: number,
    lat: number,
    dist: number,
    size: number,
  ): Promise<any[]> {
    return this.measure(ENDPOINT_SIMILAR_SEARCH, async () => {
      const apiUrl = this.buildUrl('/cakes/similar-search', {
        id,
        lon,
        lat,
        dist,
        size,
      });
      const response = await this.httpService.get(apiUrl).toPromise();
      return response.data.result;
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
