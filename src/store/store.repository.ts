import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { HydratedDocument, Model, PipelineStage } from 'mongoose';
import { Store } from './entities/store.schema';
import { StoreNotFoundException } from './exceptions/store-not-found.exception';

@Injectable()
export class StoreRepository {
  constructor(
    @InjectModel(Store.name, 'kezzle')
    private readonly storeModel: Model<Store>,
  ) {}

  async findById(id: string): Promise<Store | null> {
    return this.storeModel.findById(id);
  }

  async findByIdOrThrow(id: string): Promise<HydratedDocument<Store>> {
    let store: HydratedDocument<Store> | null;
    try {
      store = await this.storeModel.findById(id);
    } catch {
      throw new StoreNotFoundException(id);
    }
    if (!store) {
      throw new StoreNotFoundException(id);
    }
    return store;
  }

  async findByIdsWithProjection<T = any>(
    ids: string[],
    projection: Record<string, 1>,
  ): Promise<T[]> {
    return this.storeModel.find({ _id: { $in: ids } }, projection).lean<T[]>();
  }

  async create(doc: Record<string, any>): Promise<Store> {
    return this.storeModel.create(doc);
  }

  async updateOneById(id: string, set: Record<string, any>) {
    return this.storeModel.updateOne({ _id: id }, { $set: set });
  }

  async deleteById(id: string) {
    return this.storeModel.deleteOne({ _id: id });
  }

  async findByUserLike(userId: string): Promise<HydratedDocument<Store>[]> {
    return this.storeModel.find({ user_like_ids: { $in: [userId] } });
  }

  async addUserLike(storeid: string, userId: string) {
    return this.storeModel.updateOne(
      { _id: storeid },
      { $addToSet: { user_like_ids: [userId] } },
    );
  }

  async removeUserLike(storeid: string, userId: string) {
    return this.storeModel.updateOne(
      { _id: storeid },
      { $pull: { user_like_ids: userId } },
    );
  }

  async findIdsByGeoNear(
    longitude: number,
    latitude: number,
    distance?: number,
  ): Promise<string[]> {
    const geoNear: PipelineStage.GeoNear = {
      $geoNear: {
        near: { type: 'Point', coordinates: [longitude, latitude] },
        distanceField: 'dist',
        spherical: true,
      },
    };

    if (distance !== undefined && !Number.isNaN(distance)) {
      geoNear.$geoNear.maxDistance = distance;
    }

    const stores = await this.storeModel.aggregate([
      geoNear,
      { $project: { _id: 1 } },
    ]);

    return stores.map((store) => store._id.toString());
  }
}
