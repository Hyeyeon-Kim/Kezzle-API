import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cake } from './entities/cake.schema';

@Injectable()
export class CakeRepository {
  constructor(
    @InjectModel(Cake.name, 'kezzle')
    private readonly cakeModel: Model<Cake>,
  ) {}

  /**
   * Returns up to `perStoreLimit` most recent non-deleted cakes per storeId,
   * keyed by storeId. Eliminates N+1 by collapsing per-store queries into
   * a single aggregation.
   */
  async findRecentByStoreIds(
    storeIds: string[],
    perStoreLimit = 20,
  ): Promise<Map<string, any[]>> {
    if (storeIds.length === 0) {
      return new Map();
    }

    const groups = await this.cakeModel.aggregate([
      {
        $match: {
          is_delete: false,
          owner_store_id: { $in: storeIds },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$owner_store_id',
          cakes: { $push: '$$ROOT' },
        },
      },
      {
        $project: {
          _id: 1,
          cakes: { $slice: ['$cakes', perStoreLimit] },
        },
      },
    ]);

    return new Map(groups.map((g) => [g._id, g.cakes]));
  }
}
