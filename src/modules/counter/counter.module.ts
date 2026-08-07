import { Module } from '@nestjs/common';
import { CounterService } from 'src/modules/counter/infrastructure/persistence/counter.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Counter,
  CounterSchema,
} from 'src/modules/counter/infrastructure/persistence/schema/counter.schema';
import { CounterSequencePort } from './application/port/counter-sequence.port';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Counter.name, schema: CounterSchema }],
      'kezzle',
    ),
  ],
  providers: [
    CounterService,
    { provide: CounterSequencePort, useExisting: CounterService },
  ],
  exports: [CounterSequencePort],
})
export class CounterModule {}
