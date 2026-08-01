import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, PipelineStage } from 'mongoose';
import {
  CakeLikeEventReader,
  CakeLikeNetCount,
} from '../../application/port/cake-like-event.reader';
import { CakeLikeEventRecorder } from '../../application/port/cake-like-event-recorder.port';
import { CakeLikeLog } from './cake-like-event.schema';

interface NetCountRow {
  readonly _id: unknown;
  readonly app_like: number;
}

@Injectable()
export class CakeLikeEventRepository
  implements CakeLikeEventRecorder, CakeLikeEventReader
{
  constructor(
    @InjectModel(CakeLikeLog.name, 'kezzle')
    private readonly cakeLikeModel: Model<CakeLikeLog>,
  ) {}

  async record(userId: string, cakeId: string, type: boolean): Promise<void> {
    await this.cakeLikeModel.create({
      userId,
      cakeId: new mongoose.Types.ObjectId(cakeId),
      type,
    });
  }

  async getNetCounts(
    startDateStr: string,
    endDateStr: string,
    maxTimeMs?: number,
  ): Promise<CakeLikeNetCount[]> {
    const match: PipelineStage.Match = {
      $match: {
        createdAt: {
          $gte: new Date(startDateStr),
          $lte: new Date(endDateStr),
        },
      },
    };
    const group: PipelineStage.Group = {
      $group: {
        _id: '$cakeId',
        trueCount: {
          $sum: { $cond: [{ $eq: ['$type', true] }, 1, 0] },
        },
        falseCount: {
          $sum: { $cond: [{ $eq: ['$type', false] }, 1, 0] },
        },
      },
    };
    const addNetCount: PipelineStage.AddFields = {
      $addFields: {
        app_like: { $subtract: ['$trueCount', '$falseCount'] },
      },
    };

    const aggregate = this.cakeLikeModel.aggregate<NetCountRow>([
      match,
      group,
      addNetCount,
    ]);
    if (maxTimeMs !== undefined) {
      aggregate.option({ maxTimeMS: maxTimeMs });
    }
    const rows = await aggregate;
    return rows.map((row) => ({
      cakeId: String(row._id),
      appLike: Number(row.app_like),
    }));
  }
}
