import { Module } from '@nestjs/common';
import { StoreController } from './api/store.controller';
import { StoreService } from './application/store.service';
import { ObjectStorageModule } from 'src/integrations/media/object-storage.module';
import { StoreRepositoryModule } from './infrastructure/persistence/store-repository.module';
import { StoreCatalogRepositoryAdapter } from './infrastructure/store-catalog.adapter';
import { StoreCatalogReader } from './application/store-catalog.reader';
import { StoreCakeWriteContextRepositoryAdapter } from './infrastructure/store-cake-write-context.adapter';
import { StoreCakeWriteContextReader } from './application/store-cake-write-context.reader';
import { StoreLikeRepositoryAdapter } from './infrastructure/store-like.adapter';
import { StoreLikePort } from './application/store-like.port';
import { StoreMediaService } from './application/store-media.service';
import { MediaObservabilityModule } from 'src/integrations/media/media-observability.module';

@Module({
  imports: [
    ObjectStorageModule,
    StoreRepositoryModule,
    MediaObservabilityModule,
  ],
  controllers: [StoreController],
  providers: [
    StoreService,
    StoreMediaService,
    StoreCatalogRepositoryAdapter,
    { provide: StoreCatalogReader, useExisting: StoreCatalogRepositoryAdapter },
    StoreCakeWriteContextRepositoryAdapter,
    {
      provide: StoreCakeWriteContextReader,
      useExisting: StoreCakeWriteContextRepositoryAdapter,
    },
    StoreLikeRepositoryAdapter,
    { provide: StoreLikePort, useExisting: StoreLikeRepositoryAdapter },
  ],
  exports: [
    StoreService,
    StoreCatalogReader,
    StoreCakeWriteContextReader,
    StoreLikePort,
  ],
})
export class StoreModule {}
