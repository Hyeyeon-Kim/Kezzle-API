import { Module } from '@nestjs/common';
import { CakeService } from './cake.service';
import { CakeRepositoryModule } from './cake-repository.module';
import { CakeController } from './cake.controller';
import { ObjectStorageModule } from 'src/integrations/media/object-storage.module';
import { AnniversaryModule } from 'src/modules/anniversary/anniversary.module';
import { CounterModule } from 'src/modules/counter/counter.module';
import { AiSearchModule } from 'src/integrations/ai-search/ai-search.module';
import { StoreModule } from 'src/modules/store/store.module';
import { CakeCatalogRepositoryAdapter } from './cake-catalog.adapter';
import { CakeCatalogReader } from './cake-catalog.reader';
import { CakeLikeRepositoryAdapter } from './cake-like.adapter';
import { CakeLikePort } from './cake-like.port';
import { CakeMediaService } from './cake-media.service';
import { CakeImportService } from './cake-import.service';
import { MediaObservabilityModule } from 'src/integrations/media/media-observability.module';

@Module({
  imports: [
    ObjectStorageModule,
    AnniversaryModule,
    CounterModule,
    AiSearchModule,
    CakeRepositoryModule,
    StoreModule,
    MediaObservabilityModule,
  ],
  controllers: [CakeController],
  providers: [
    CakeService,
    CakeMediaService,
    CakeImportService,
    CakeCatalogRepositoryAdapter,
    { provide: CakeCatalogReader, useExisting: CakeCatalogRepositoryAdapter },
    CakeLikeRepositoryAdapter,
    { provide: CakeLikePort, useExisting: CakeLikeRepositoryAdapter },
  ],
  exports: [CakeService, CakeCatalogReader, CakeLikePort],
})
export class CakeModule {}
