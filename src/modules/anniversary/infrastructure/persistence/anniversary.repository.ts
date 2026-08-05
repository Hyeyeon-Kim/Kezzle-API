import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AnniversaryView } from '../../application/anniversary.view';
import { Anniversary } from './entities/anniversary.schema';
import { AnniversaryPersistenceMapper } from './anniversary.persistence-mapper';

@Injectable()
export class AnniversaryRepository {
  constructor(
    @InjectModel(Anniversary.name, 'kezzle')
    private readonly anniversaryModel: Model<Anniversary>,
  ) {}

  async findById(id: string): Promise<AnniversaryView | null> {
    const anniversary = await this.anniversaryModel.findById(id);
    return anniversary
      ? AnniversaryPersistenceMapper.toView(anniversary)
      : null;
  }

  async findNext(maxTimeMs?: number): Promise<AnniversaryView | null> {
    const query = this.anniversaryModel
      .find({ date: { $gte: new Date() } })
      .sort({ date: 1 })
      .limit(1);
    if (maxTimeMs !== undefined) {
      query.maxTimeMS(maxTimeMs);
    }
    const [anniversary] = await query;
    return anniversary
      ? AnniversaryPersistenceMapper.toView(anniversary)
      : null;
  }
}
