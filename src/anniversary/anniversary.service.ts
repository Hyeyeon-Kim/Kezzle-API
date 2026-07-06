import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Anniversary } from './entities/anniversary.schema';
import { Model } from 'mongoose';
import { AnniversaryDto } from './dto/response-anniversary.dto';
import { HomeResilienceMetricsService } from 'src/home-resilience/home-resilience-metrics.service';
import { HomeCacheService } from 'src/home-cache/home-cache.service';
import { homeCachePolicy } from 'src/home-cache/home-cache.policy';
import { ClipClient } from 'src/ai-search/clip-client';

@Injectable()
export class AnniversaryService {
  constructor(
    @InjectModel(Anniversary.name, 'kezzle')
    private readonly AnniversaryModel: Model<Anniversary>,
    private readonly clipClient: ClipClient,
    private readonly homeMetrics: HomeResilienceMetricsService,
    private readonly homeCache: HomeCacheService,
  ) {}

  async getAnniversaryWord(id: string) {
    this.homeMetrics.countDb();
    return await this.AnniversaryModel.findById(id);
  }

  async getAnniversary(signal?: AbortSignal, maxTimeMs?: number) {
    return this.homeCache.getWithSwr({
      key: 'home:anniversary',
      ...homeCachePolicy('anniversary'),
      refresh: () => this.loadAnniversary(signal, maxTimeMs),
    });
  }

  private async loadAnniversary(signal?: AbortSignal, maxTimeMs?: number) {
    const nowDate = new Date();
    this.homeMetrics.countDb();
    const query = this.AnniversaryModel.find({
      date: { $gte: nowDate },
    })
      .sort({
        date: 1,
      })
      .limit(1);
    if (maxTimeMs !== undefined) {
      query.maxTimeMS(maxTimeMs);
    }
    const anniversary = await query;
    const keyword = anniversary[0].keyword.join(', ');
    this.homeMetrics.countAi('clip');
    const cakes = await this.clipClient
      .koSearch(keyword, 6, signal)
      .catch((error) => {
        this.homeMetrics.countAiError('clip');
        throw error;
      });

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
