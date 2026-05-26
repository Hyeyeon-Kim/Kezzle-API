import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { MetricsService } from 'src/metrics/metrics.service';

const MODEL = 'vit';
const ENDPOINT_SIMILAR_SEARCH = 'similar-search';

@Injectable()
export class VitClient {
  constructor(
    private readonly httpService: HttpService,
    private readonly metricsService: MetricsService,
  ) {}

  async similarSearch(id: string, size: number): Promise<any[]> {
    return this.measure(ENDPOINT_SIMILAR_SEARCH, async () => {
      const apiUrl = `${this.baseUrl()}/cakes/similar-search?id=${id}&size=${size}`;
      const response = await this.httpService.get(apiUrl).toPromise();
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
      const apiUrl = `${this.baseUrl()}/cakes/similar-search?id=${id}&lon=${lon}&lat=${lat}&dist=${dist}&size=${size}`;
      const response = await this.httpService.get(apiUrl).toPromise();
      return response.data.result;
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
    return process.env.VIT_API_BASE_URL ?? 'https://api.kezzlecake.com/vit';
  }
}
