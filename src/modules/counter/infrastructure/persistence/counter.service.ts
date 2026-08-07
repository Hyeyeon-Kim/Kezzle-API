import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Counter } from 'src/modules/counter/infrastructure/persistence/schema/counter.schema';
import { Model } from 'mongoose';
import { CounterSequencePort } from 'src/modules/counter/application/port/counter-sequence.port';

@Injectable()
export class CounterService implements CounterSequencePort {
  constructor(
    @InjectModel(Counter.name, 'kezzle')
    private readonly counterModel: Model<Counter>,
  ) {}

  async getNextSequenceValue(sequenceName: string) {
    const ret = await this.counterModel.findOneAndUpdate(
      {
        sequenceName: sequenceName,
      },
      {
        $inc: { seq: 1 },
      },
      {
        new: true,
        upsert: true,
      },
    );

    return ret.seq;
  }
}
