import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { HydratedDocument, Model } from 'mongoose';
import { Cake } from './entities/cake.schema';
import { CakeNotFoundException } from './exceptions/cake-not-found.exception';

@Injectable()
export class CakeRepository {
  constructor(
    @InjectModel(Cake.name, 'kezzle')
    private readonly cakeModel: Model<Cake>,
  ) {}

  async findByIdOrThrow(id: string): Promise<HydratedDocument<Cake>> {
    let cake: HydratedDocument<Cake> | null;
    try {
      cake = await this.cakeModel.findById(id);
    } catch {
      throw new CakeNotFoundException(id);
    }
    if (!cake) {
      throw new CakeNotFoundException(id);
    }
    return cake;
  }

  async create(doc: Partial<Cake>): Promise<Cake> {
    return this.cakeModel.create(doc);
  }

  async updateOneById(id: string, set: Record<string, any>) {
    return this.cakeModel.updateOne({ _id: id }, { $set: set });
  }

  async findByIds(ids: string[]): Promise<HydratedDocument<Cake>[]> {
    return this.cakeModel.find({ _id: { $in: ids } });
  }

  async addUserLike(cakeid: string, userId: string) {
    return this.cakeModel.updateOne(
      { _id: cakeid },
      { $addToSet: { user_like_ids: [userId] } },
    );
  }

  async removeUserLike(cakeid: string, userId: string) {
    return this.cakeModel.updateOne(
      { _id: cakeid },
      { $pull: { user_like_ids: userId } },
    );
  }

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
