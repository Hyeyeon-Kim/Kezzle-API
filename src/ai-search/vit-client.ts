import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class VitClient {
  constructor(private readonly httpService: HttpService) {}

  async similarSearch(id: string, size: number): Promise<any[]> {
    const apiUrl = `${this.baseUrl()}/cakes/similar-search?id=${id}&size=${size}`;
    const response = await this.httpService.get(apiUrl).toPromise();
    return response.data.result;
  }

  async similarSearchWithLocation(
    id: string,
    lon: number,
    lat: number,
    dist: number,
    size: number,
  ): Promise<any[]> {
    const apiUrl = `${this.baseUrl()}/cakes/similar-search?id=${id}&lon=${lon}&lat=${lat}&dist=${dist}&size=${size}`;
    const response = await this.httpService.get(apiUrl).toPromise();
    return response.data.result;
  }

  private baseUrl(): string {
    return process.env.VIT_API_BASE_URL ?? 'https://api.kezzlecake.com/vit';
  }
}
