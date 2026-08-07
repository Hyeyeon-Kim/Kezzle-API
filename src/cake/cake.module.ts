import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CakeQueryService } from './application/query/cake-query.service';
import { CakeController } from './api/cake.controller';
import { ObjectStorageModule } from 'src/media/object-storage.module';
import { AnniversaryModule } from 'src/anniversary/anniversary.module';
import { CounterModule } from 'src/counter/counter.module';
import { AiSearchModule } from 'src/ai-search/ai-search.module';
import { StoreModule } from 'src/store/store.module';
import { CakeCatalogAdapter } from './infrastructure/integration/catalog/cake-catalog.adapter';
import { CakeCatalogPort } from './application/port/cake-catalog.port';
import { CakeLikeAdapter } from './infrastructure/integration/like/cake-like.adapter';
import { CakeLikePort } from './application/port/cake-like.port';
import { CakeMediaService } from './application/media/cake-media.service';
import { CakeImportService } from './application/import/cake-import.service';
import { MediaObservabilityModule } from 'src/media/media-observability.module';
import {
  CakePersistenceModel,
  CakeSchema,
} from './infrastructure/persistence/schema/cake.schema';
import { MongooseCakeRepository } from './infrastructure/persistence/mongoose-cake.repository';
import { CakeRepositoryPort } from './application/port/cake-repository.port';

@Module({
  imports: [
    ObjectStorageModule,
    AnniversaryModule,
    CounterModule,
    AiSearchModule,
    MongooseModule.forFeature(
      [{ name: CakePersistenceModel.name, schema: CakeSchema }],
      'kezzle',
    ),
    StoreModule,
    MediaObservabilityModule,
  ],
  controllers: [CakeController],
  providers: [
    CakeQueryService,
    CakeMediaService,
    CakeImportService,
    MongooseCakeRepository,
    { provide: CakeRepositoryPort, useExisting: MongooseCakeRepository },
    CakeCatalogAdapter,
    { provide: CakeCatalogPort, useExisting: CakeCatalogAdapter },
    CakeLikeAdapter,
    { provide: CakeLikePort, useExisting: CakeLikeAdapter },
  ],
  exports: [CakeQueryService, CakeCatalogPort, CakeLikePort],
})
export class CakeModule {}
