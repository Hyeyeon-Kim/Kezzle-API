import { Module } from '@nestjs/common';
import { StoreController } from 'src/store/api/store.controller';
import { StoreService } from 'src/store/application/store.service';
import { ObjectStorageModule } from 'src/media/object-storage.module';
import { StoreRepositoryModule } from 'src/store/infrastructure/persistence/store-repository.module';
import { StoreCatalogRepositoryAdapter } from 'src/store/infrastructure/integration/catalog/store-catalog.adapter';
import { StoreCatalogReader } from 'src/store/application/port/store-catalog.reader';
import { StoreCakeWriteContextRepositoryAdapter } from 'src/store/infrastructure/integration/cake/store-cake-write-context.adapter';
import { StoreCakeWriteContextReader } from 'src/store/application/port/store-cake-write-context.reader';
import { StoreLikeRepositoryAdapter } from 'src/store/infrastructure/integration/like/store-like.adapter';
import { StoreLikePort } from 'src/store/application/port/store-like.port';
import { StoreMediaService } from 'src/store/application/media/store-media.service';
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
