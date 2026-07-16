import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Curation } from './entities/curation.schema';

@Injectable()
export class CurationQueryService {
  constructor(
    @InjectModel(Curation.name, 'kezzle')
    private readonly curationModel: Model<Curation>,
  ) {}

  findFeatured(limit: number, maxTimeMs?: number) {
    const query = this.curationModel.find().limit(limit);
    if (maxTimeMs !== undefined) {
      query.maxTimeMS(maxTimeMs);
    }
    return query;
  }
}
