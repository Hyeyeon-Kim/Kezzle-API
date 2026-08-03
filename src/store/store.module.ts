import { Module } from '@nestjs/common';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { ObjectStorageModule } from 'src/media/object-storage.module';
import { StoreRepositoryModule } from './store-repository.module';
import { StoreCatalogRepositoryAdapter } from './store-catalog.adapter';
import { StoreCatalogReader } from './store-catalog.reader';
import { StoreCakeWriteContextRepositoryAdapter } from './store-cake-write-context.adapter';
import { StoreCakeWriteContextReader } from './store-cake-write-context.reader';
import { StoreLikeRepositoryAdapter } from './store-like.adapter';
import { StoreLikePort } from './store-like.port';
import { StoreMediaService } from './store-media.service';
import { MediaObservabilityModule } from 'src/media/media-observability.module';

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
