import { Module } from '@nestjs/common';
import { CounterService } from 'src/counter/infrastructure/persistence/counter.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Counter,
  CounterSchema,
} from 'src/counter/infrastructure/persistence/schema/counter.schema';

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
