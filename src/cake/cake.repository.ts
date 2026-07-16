import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { HydratedDocument, Model, PipelineStage } from 'mongoose';
import { ObjectId } from 'mongodb';
import { Cake } from './entities/cake.schema';
import { CakeNotFoundException } from './exceptions/cake-not-found.exception';

@Injectable()
export class CakeRepository {
  constructor(
    @InjectModel(Cake.name, 'kezzle')
    private readonly cakeModel: Model<Cake>,
  ) {}

  async findById(
    id: string,
    maxTimeMs?: number,
  ): Promise<HydratedDocument<Cake> | null> {
    const query = this.cakeModel.findOne({ _id: id, is_delete: false });
    if (maxTimeMs !== undefined) {
      query.maxTimeMS(maxTimeMs);
    }
    return query;
  }

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

  async sampleOne(maxTimeMs?: number): Promise<any> {
    const aggregate = this.cakeModel.aggregate([
      { $match: { is_delete: false } },
      { $sample: { size: 1 } },
    ]);
    if (maxTimeMs !== undefined) {
      aggregate.option({ maxTimeMS: maxTimeMs });
    }
    const result = await aggregate;
    return result[0];
  }

  /** findAll: 위치 내 store들의 cake를 cursor 오름차순으로. limit개까지. */
  async findInStoresByCursor(
    storeIds: string[],
    after: string,
    limit: number,
  ): Promise<any[]> {
    const match: PipelineStage.Match['$match'] = {
      is_delete: false,
      owner_store_id: { $in: storeIds },
    };
    if (after !== undefined && after.trim() !== '') {
      match.cursor = { $gt: after };
    }
    return this.cakeModel
      .aggregate([{ $sort: { cursor: 1 } }, { $match: match }])
      .limit(limit);
  }

  /** findAllByLocation: 위치 내 store들의 cake를 _id(ObjectId) 기준 페이지네이션. limit개까지. */
  async findInStoresAfterId(
    storeIds: string[],
    after: string,
    limit: number,
  ): Promise<any[]> {
    const match: PipelineStage.Match['$match'] = {
      is_delete: false,
      owner_store_id: { $in: storeIds },
    };
    if (after !== undefined && after.trim() !== '') {
      match._id = { $gt: new ObjectId(after) };
    }
    return this.cakeModel.aggregate([{ $match: match }]).limit(limit);
  }

  /** findAllByNewest: 최신순(_id desc), after 있으면 _id(ObjectId) 미만. limit개까지. */
  async findNewest(
    after: string,
    limit: number,
    maxTimeMs?: number,
  ): Promise<any[]> {
    const match: PipelineStage.Match['$match'] = { is_delete: false };
    if (after !== undefined) {
      match._id = { $lt: new ObjectId(after) };
    }
    const aggregate = this.cakeModel
      .aggregate([{ $match: match }, { $sort: { _id: -1 } }])
      .limit(limit);
    if (maxTimeMs !== undefined) {
      aggregate.option({ maxTimeMS: maxTimeMs });
    }
    return aggregate;
  }

  /** findCake: 특정 store의 cake, after 있으면 _id(raw) 초과. limit개까지. */
  async findByStoreIdAfter(
    storeId: string,
    after: any,
    limit: number,
  ): Promise<HydratedDocument<Cake>[]> {
    const filter: Record<string, any> = {
      is_delete: false,
      owner_store_id: storeId,
    };
    if (after !== undefined) {
      filter._id = { $gt: after };
    }
    return this.cakeModel.find(filter).limit(limit);
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
