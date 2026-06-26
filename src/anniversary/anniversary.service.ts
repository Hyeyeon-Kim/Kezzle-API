import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Anniversary } from './entities/anniversary.schema';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { AnniversaryDto } from './dto/response-anniversary.dto';
import { HomeResilienceMetricsService } from 'src/home-resilience/home-resilience-metrics.service';

@Injectable()
export class AnniversaryService {
  constructor(
    @InjectModel(Anniversary.name, 'kezzle')
    private readonly AnniversaryModel: Model<Anniversary>,
    private readonly httpService: HttpService,
    private readonly homeMetrics: HomeResilienceMetricsService,
  ) {}

  private clipApiUrl(path: string): string {
    const baseUrl =
      process.env.CLIP_API_BASE_URL ?? 'https://api.kezzlecake.com/clip';
    return `${baseUrl}${path}`;
  }

  async getAnniversaryWord(id: string) {
    this.homeMetrics.countDb();
    return await this.AnniversaryModel.findById(id);
  }

  async getAnniversary() {
    const nowDate = new Date();
    this.homeMetrics.countDb();
    const anniversary = await this.AnniversaryModel.find({
      date: { $gte: nowDate },
    })
      .sort({
        date: 1,
      })
      .limit(1);
    const keyword = anniversary[0].keyword.join(', ');
    const apiUrl = this.clipApiUrl(
      `/cakes/ko-search?keyword=${keyword}&size=6`,
    );
    this.homeMetrics.countAi();
    const response = await this.httpService
      .get(apiUrl)
      .toPromise()
      .catch((error) => {
        this.homeMetrics.countAiError();
        throw error;
      });
    const cakes = response.data.result;

    const images = [];
    for (const cake of cakes) {
      images.push(cake.image.s3Url);
    }
    const now = new Date();
    const day =
      Math.abs(now.getTime() - anniversary[0].date.getTime()) /
      (1000 * 60 * 60 * 24);
    return new AnniversaryDto(anniversary[0], images, Math.floor(day));
  }
}
