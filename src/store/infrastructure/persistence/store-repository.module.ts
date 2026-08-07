import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Store,
  StoreSchema,
} from 'src/store/infrastructure/persistence/schema/store.schema';
import { StoreRepository } from './store.repository';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Store.name, schema: StoreSchema }],
      'kezzle',
    ),
  ],
  providers: [StoreRepository],
  exports: [StoreRepository],
})
export class StoreRepositoryModule {}
