import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Store,
  StoreSchema,
} from 'src/modules/store/infrastructure/persistence/schema/store.schema';
import { StoreRepository } from './store.repository';
import { StoreRepositoryPort } from 'src/modules/store/application/port/store-repository.port';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Store.name, schema: StoreSchema }],
      'kezzle',
    ),
  ],
  providers: [
    StoreRepository,
    { provide: StoreRepositoryPort, useExisting: StoreRepository },
  ],
  exports: [StoreRepository, StoreRepositoryPort],
})
export class StoreRepositoryModule {}
