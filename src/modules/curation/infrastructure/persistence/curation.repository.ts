import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WriteResult } from 'src/shared/application/write-result';
import { CreateCurationData } from '../../application/curation.command';
import {
  CurationCakeSnapshotView,
  CurationView,
  StaleCurationView,
} from '../../application/curation.view';
import { Curation } from './entities/curation.schema';
import { CurationNotFoundException } from '../../application/exceptions/curation-not-found.exception';
import { CurationPersistenceMapper } from './curation.persistence-mapper';

@Injectable()
export class CurationRepository {
  constructor(
    @InjectModel(Curation.name, 'kezzle')
    private readonly curationModel: Model<Curation>,
  ) {}

  async create(data: CreateCurationData): Promise<CurationView> {
    const curation = await this.curationModel.create(
      CurationPersistenceMapper.toCreatePersistence(data),
    );
    return CurationPersistenceMapper.toView(curation);
  }

  async findByIdOrThrow(id: string): Promise<CurationView> {
    let curation: Curation | null;
    try {
      curation = await this.curationModel.findById(id);
    } catch {
      throw new CurationNotFoundException(id);
    }
    if (!curation) {
      throw new CurationNotFoundException(id);
    }
    return CurationPersistenceMapper.toView(curation);
  }

  async updateCakes(
    id: string,
    cakes: CurationCakeSnapshotView[],
  ): Promise<WriteResult> {
    return this.curationModel.updateOne(
      { _id: id },
      {
        $set: {
          cakes: cakes.map((cake) =>
            CurationPersistenceMapper.toCakePersistence(cake),
          ),
        },
      },
    );
  }

  async findFeatured(
    limit: number,
    maxTimeMs?: number,
  ): Promise<CurationView[]> {
    const query = this.curationModel.find().limit(limit);
    if (maxTimeMs !== undefined) {
      query.maxTimeMS(maxTimeMs);
    }
    const curations = await query;
    return curations.map((curation) =>
      CurationPersistenceMapper.toView(curation),
    );
  }

  async findStale(before: Date): Promise<StaleCurationView[]> {
    const curations = await this.curationModel
      .find({ updatedAt: { $lt: before } })
      .select('_id updatedAt')
      .lean();
    return curations.map((curation) =>
      CurationPersistenceMapper.toStaleView(curation),
    );
  }

  async claimRefresh(
    id: string,
    expectedUpdatedAt: Date | undefined,
    claimedBefore: Date,
    claimedAt: Date,
  ): Promise<boolean> {
    const claimed = await this.curationModel
      .findOneAndUpdate(
        {
          _id: id,
          updatedAt: expectedUpdatedAt,
          $or: [
            { refreshClaimedAt: { $exists: false } },
            { refreshClaimedAt: null },
            { refreshClaimedAt: { $lt: claimedBefore } },
          ],
        },
        { $set: { refreshClaimedAt: claimedAt } },
        { timestamps: false },
      )
      .lean();
    return claimed != null;
  }
}
