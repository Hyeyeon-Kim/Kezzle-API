import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CakeQueryService } from './application/query/cake-query.service';
import { CakeController } from './api/cake.controller';
import { ObjectStorageModule } from 'src/integrations/media/object-storage.module';
import { AnniversaryModule } from 'src/modules/anniversary/anniversary.module';
import { CounterModule } from 'src/modules/counter/counter.module';
import { AiSearchModule } from 'src/integrations/ai-search/ai-search.module';
import { StoreModule } from 'src/modules/store/store.module';
import { CakeCatalogAdapter } from './infrastructure/integration/catalog/cake-catalog.adapter';
import { CakeCatalogPort } from './application/port/cake-catalog.port';
import { CakeLikeAdapter } from './infrastructure/integration/like/cake-like.adapter';
import { CakeLikePort } from './application/port/cake-like.port';
import { CakeMediaService } from './application/media/cake-media.service';
import { CakeImportService } from './application/import/cake-import.service';
import { MediaObservabilityModule } from 'src/integrations/media/media-observability.module';
import {
  CAKE_MODEL_NAME,
  CakeSchema,
} from './infrastructure/persistence/schema/cake.schema';
import { MongooseCakeRepository } from './infrastructure/persistence/mongoose-cake.repository';
import { CakeRepositoryPort } from './application/port/cake-repository.port';
import { CakeCursorGeneratorPort } from './application/port/cake-cursor-generator.port';
import { MongoObjectIdCakeCursorAdapter } from './infrastructure/persistence/mongo-object-id-cake-cursor.adapter';

@Module({
  imports: [
    ObjectStorageModule,
    AnniversaryModule,
    CounterModule,
    AiSearchModule,
    MongooseModule.forFeature(
      [{ name: CAKE_MODEL_NAME, schema: CakeSchema }],
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
    MongoObjectIdCakeCursorAdapter,
    {
      provide: CakeCursorGeneratorPort,
      useExisting: MongoObjectIdCakeCursorAdapter,
    },
    CakeCatalogAdapter,
    { provide: CakeCatalogPort, useExisting: CakeCatalogAdapter },
    CakeLikeAdapter,
    { provide: CakeLikePort, useExisting: CakeLikeAdapter },
  ],
  exports: [CakeQueryService, CakeCatalogPort, CakeLikePort],
})
export class CakeModule {}
