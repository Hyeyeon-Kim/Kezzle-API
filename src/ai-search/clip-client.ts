import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

export interface ClipKoSearchPageResult {
  result: any[];
  nextPage?: number;
  isLastPage?: boolean;
}

@Injectable()
export class ClipClient {
  constructor(private readonly httpService: HttpService) {}

  async koSearch(keyword: string, size: number): Promise<any[]> {
    const apiUrl = `${this.baseUrl()}/cakes/ko-search?keyword=${keyword}&size=${size}`;
    const response = await this.httpService.get(apiUrl).toPromise();
    return response.data.result;
  }

  async koSearchPage(
    keyword: string,
    size: number,
    page: number,
  ): Promise<ClipKoSearchPageResult> {
    const apiUrl = `${this.baseUrl()}/cakes/ko-search-page?keyword=${keyword}&size=${size}&page=${page}`;
    const response = await this.httpService.get(apiUrl).toPromise();
    return {
      result: response.data.result,
      nextPage: response.data.nextPage,
      isLastPage: response.data.isLastPage,
    };
  }

  private baseUrl(): string {
    return process.env.CLIP_API_BASE_URL ?? 'https://api.kezzlecake.com/clip';
  }
}
