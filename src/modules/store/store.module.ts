import { Module } from '@nestjs/common';
import { StoreController } from 'src/modules/store/api/store.controller';
import { StoreService } from 'src/modules/store/application/store.service';
import { ObjectStorageModule } from 'src/integrations/media/object-storage.module';
import { StoreRepositoryModule } from 'src/modules/store/infrastructure/persistence/store-repository.module';
import { StoreCatalogRepositoryAdapter } from 'src/modules/store/infrastructure/integration/catalog/store-catalog.adapter';
import { StoreCatalogReader } from 'src/modules/store/application/port/store-catalog.reader';
import { StoreCakeWriteContextRepositoryAdapter } from 'src/modules/store/infrastructure/integration/cake/store-cake-write-context.adapter';
import { StoreCakeWriteContextReader } from 'src/modules/store/application/port/store-cake-write-context.reader';
import { StoreLikeRepositoryAdapter } from 'src/modules/store/infrastructure/integration/like/store-like.adapter';
import { StoreLikePort } from 'src/modules/store/application/port/store-like.port';
import { StoreMediaService } from 'src/modules/store/application/media/store-media.service';
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
  exports: [StoreCatalogReader, StoreCakeWriteContextReader, StoreLikePort],
})
export class StoreModule {}
