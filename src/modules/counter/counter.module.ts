import { Module } from '@nestjs/common';
import { CounterService } from './infrastructure/persistence/counter.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Counter,
  CounterSchema,
} from './infrastructure/persistence/entities/counter.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Counter.name, schema: CounterSchema }],
      'kezzle',
    ),
  ],
  providers: [CounterService],
  exports: [CounterService],
})
export class CounterModule {}
