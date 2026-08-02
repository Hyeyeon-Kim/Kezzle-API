import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, PipelineStage } from 'mongoose';
import { ObjectId } from 'mongodb';
import { Cake } from './entities/cake.schema';
import { CakeNotFoundException } from './exceptions/cake-not-found.exception';
import { CakeView } from './application/cake.view';
import { CreateCakeData, UpdateCakeData } from './application/cake.command';
import { CakePersistenceMapper } from './cake.persistence-mapper';
import { WriteResult } from 'src/common/application/write-result';

@Injectable()
export class CakeRepository {
  constructor(
    @InjectModel(Cake.name, 'kezzle')
    private readonly cakeModel: Model<Cake>,
  ) {}

  async findById(id: string, maxTimeMs?: number): Promise<CakeView | null> {
    const query = this.cakeModel.findOne({ _id: id, is_delete: false });
    if (maxTimeMs !== undefined) {
      query.maxTimeMS(maxTimeMs);
    }
    const cake = await query;
    return cake ? CakePersistenceMapper.toView(cake) : null;
  }

  async findByIdOrThrow(id: string): Promise<CakeView> {
    let cake: Cake | null;
    try {
      cake = await this.cakeModel.findById(id);
    } catch {
      throw new CakeNotFoundException(id);
    }
    if (!cake) {
      throw new CakeNotFoundException(id);
    }
    return CakePersistenceMapper.toView(cake);
  }

  async sampleOne(maxTimeMs?: number): Promise<CakeView | null> {
    const aggregate = this.cakeModel.aggregate([
      { $match: { is_delete: false } },
      { $sample: { size: 1 } },
    ]);
    if (maxTimeMs !== undefined) {
      aggregate.option({ maxTimeMS: maxTimeMs });
    }
    const result = await aggregate;
    const sampledCake = result[0];
    return sampledCake ? CakePersistenceMapper.toView(sampledCake) : null;
  }

  /** findAll: 위치 내 store들의 cake를 cursor 오름차순으로. limit개까지. */
  async findInStoresByCursor(
    storeIds: string[],
    after: string,
    limit: number,
  ): Promise<CakeView[]> {
    const match: PipelineStage.Match['$match'] = {
      is_delete: false,
      owner_store_id: { $in: storeIds },
    };
    if (after !== undefined && after.trim() !== '') {
      match.cursor = { $gt: after };
    }
    const cakes = await this.cakeModel
      .aggregate([{ $sort: { cursor: 1 } }, { $match: match }])
      .limit(limit);
    return cakes.map((cake) => CakePersistenceMapper.toView(cake));
  }

  /** findAllByLocation: 위치 내 store들의 cake를 _id(ObjectId) 기준 페이지네이션. limit개까지. */
  async findInStoresAfterId(
    storeIds: string[],
    after: string,
    limit: number,
  ): Promise<CakeView[]> {
    const match: PipelineStage.Match['$match'] = {
      is_delete: false,
      owner_store_id: { $in: storeIds },
    };
    if (after !== undefined && after.trim() !== '') {
      match._id = { $gt: new ObjectId(after) };
    }
    const cakes = await this.cakeModel
      .aggregate([{ $match: match }])
      .limit(limit);
    return cakes.map((cake) => CakePersistenceMapper.toView(cake));
  }

  /** findAllByNewest: 최신순(_id desc), after 있으면 _id(ObjectId) 미만. limit개까지. */
  async findNewest(
    after: string,
    limit: number,
    maxTimeMs?: number,
  ): Promise<CakeView[]> {
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
    const cakes = await aggregate;
    return cakes.map((cake) => CakePersistenceMapper.toView(cake));
  }

  /** findCake: 특정 store의 cake, after 있으면 _id(raw) 초과. limit개까지. */
  async findByStoreIdAfter(
    storeId: string,
    after: string,
    limit: number,
  ): Promise<CakeView[]> {
    const filter: FilterQuery<Cake> = {
      is_delete: false,
      owner_store_id: storeId,
    };
    if (after !== undefined) {
      filter._id = { $gt: after };
    }
    const cakes = await this.cakeModel.find(filter).limit(limit);
    return cakes.map((cake) => CakePersistenceMapper.toView(cake));
  }

  async create(data: CreateCakeData): Promise<CakeView> {
    const cake = await this.cakeModel.create(
      CakePersistenceMapper.toCreatePersistence(data),
    );
    return CakePersistenceMapper.toView(cake);
  }

  async updateOneById(id: string, data: UpdateCakeData): Promise<WriteResult> {
    return this.cakeModel.updateOne(
      { _id: id },
      { $set: CakePersistenceMapper.toUpdatePersistence(data) },
    );
  }

  async findByIds(ids: string[]): Promise<CakeView[]> {
    const cakes = await this.cakeModel.find({ _id: { $in: ids } });
    return cakes.map((cake) => CakePersistenceMapper.toView(cake));
  }

  async addUserLike(cakeid: string, userId: string): Promise<void> {
    await this.cakeModel.updateOne(
      { _id: cakeid },
      { $addToSet: { user_like_ids: [userId] } },
    );
  }

  async removeUserLike(cakeid: string, userId: string): Promise<void> {
    await this.cakeModel.updateOne(
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
  ): Promise<Map<string, CakeView[]>> {
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

    return new Map(
      groups.map((group) => [
        group._id,
        group.cakes.map((cake) => CakePersistenceMapper.toView(cake)),
      ]),
    );
  }
}
