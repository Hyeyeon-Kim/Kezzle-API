import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Anniversary } from './entities/anniversary.schema';
import { Model } from 'mongoose';
import { AnniversaryDto } from './dto/response-anniversary.dto';
import { ClipClient } from 'src/ai-search/clip-client';

@Injectable()
export class AnniversaryService {
  constructor(
    @InjectModel(Anniversary.name, 'kezzle')
    private readonly AnniversaryModel: Model<Anniversary>,
    private readonly clipClient: ClipClient,
  ) {}

  async getAnniversaryWord(id: string) {
    return await this.AnniversaryModel.findById(id);
  }

  async getAnniversary(signal?: AbortSignal, maxTimeMs?: number) {
    const nowDate = new Date();
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
    const cakes = await this.clipClient.koSearch(keyword, 6, signal);

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
