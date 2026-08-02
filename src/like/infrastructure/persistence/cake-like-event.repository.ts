import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { CakeLikeEventRecorder } from '../../application/port/cake-like-event-recorder.port';
import { CakeLikeLog } from './cake-like-event.schema';

@Injectable()
export class CakeLikeEventRepository implements CakeLikeEventRecorder {
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
}
