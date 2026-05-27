import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { Store } from './entities/store.schema';

@Injectable()
export class StoreRepository {
  constructor(
    @InjectModel(Store.name, 'kezzle')
    private readonly storeModel: Model<Store>,
  ) {}

  async findById(id: string): Promise<Store | null> {
    return this.storeModel.findById(id);
  }

  async findByIdsWithProjection<T = any>(
    ids: string[],
    projection: Record<string, 1>,
  ): Promise<T[]> {
    return this.storeModel.find({ _id: { $in: ids } }, projection).lean<T[]>();
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
