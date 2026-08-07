import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { Store } from 'src/modules/store/infrastructure/persistence/schema/store.schema';
import { StoreNotFoundException } from 'src/modules/store/application/exception/store-not-found.exception';
import {
  CreateStoreData,
  UpdateStoreData,
} from 'src/modules/store/application/store.command';
import {
  StoreSummaryView,
  StoreView,
} from 'src/modules/store/application/store.view';
import { StoreRepositoryPort } from 'src/modules/store/application/port/store-repository.port';
import { StorePersistenceMapper } from './store.persistence-mapper';
import { WriteResult } from 'src/shared/application/write-result';

const STORE_SUMMARY_PROJECTION = {
  name: 1 as const,
  address: 1 as const,
  taste: 1 as const,
  location: 1 as const,
};

@Injectable()
export class StoreRepository implements StoreRepositoryPort {
  constructor(
    @InjectModel(Store.name, 'kezzle')
    private readonly storeModel: Model<Store>,
  ) {}

  async findById(id: string): Promise<StoreView | null> {
    const store = await this.storeModel.findById(id);
    return store ? StorePersistenceMapper.toView(store) : null;
  }

  async findByIdOrThrow(id: string): Promise<StoreView> {
    let store: Store | null;
    try {
      store = await this.storeModel.findById(id);
    } catch {
      throw new StoreNotFoundException(id);
    }
    if (!store) {
      throw new StoreNotFoundException(id);
    }
    return StorePersistenceMapper.toView(store);
  }

  async findSummariesByIds(ids: string[]): Promise<StoreSummaryView[]> {
    const stores = await this.storeModel
      .find({ _id: { $in: ids } }, STORE_SUMMARY_PROJECTION)
      .lean();
    return stores.map((store) => StorePersistenceMapper.toSummaryView(store));
  }

  async create(data: CreateStoreData): Promise<StoreView> {
    const store = await this.storeModel.create(
      StorePersistenceMapper.toCreatePersistence(data),
    );
    return StorePersistenceMapper.toView(store);
  }

  async updateOneById(id: string, data: UpdateStoreData): Promise<WriteResult> {
    return this.storeModel.updateOne(
      { _id: id },
      { $set: StorePersistenceMapper.toUpdatePersistence(data) },
    );
  }

  async deleteById(id: string): Promise<WriteResult> {
    return this.storeModel.deleteOne({ _id: id });
  }

  async findByUserLike(userId: string): Promise<StoreView[]> {
    const stores = await this.storeModel.find({
      user_like_ids: { $in: [userId] },
    });
    return stores.map((store) => StorePersistenceMapper.toView(store));
  }

  async addUserLike(storeId: string, userId: string): Promise<void> {
    await this.storeModel.updateOne(
      { _id: storeId },
      { $addToSet: { user_like_ids: [userId] } },
    );
  }

  async removeUserLike(storeId: string, userId: string): Promise<void> {
    await this.storeModel.updateOne(
      { _id: storeId },
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

  /**
   * StoreService.findAll용: 위치 기반 store 전체 문서(+dist)를 limit개까지.
   * after가 NaN이면 dist 필터 없이 전체에서 limit개.
   */
  async findByGeoNear(
    longitude: number,
    latitude: number,
    distance: number,
    after: number,
    limit: number,
  ): Promise<StoreView[]> {
    const geoNear: PipelineStage.GeoNear = {
      $geoNear: {
        near: { type: 'Point', coordinates: [longitude, latitude] },
        distanceField: 'dist',
        spherical: true,
      },
    };

    if (!Number.isNaN(distance)) {
      geoNear.$geoNear.maxDistance = distance;
    }

    const pipeline: PipelineStage[] = [
      geoNear,
      { $match: { dist: { $gt: after } } },
    ];

    if (Number.isNaN(after)) {
      pipeline.pop();
    }

    const stores = await this.storeModel.aggregate(pipeline).limit(limit);
    return stores.map((store) => StorePersistenceMapper.toView(store));
  }
}
