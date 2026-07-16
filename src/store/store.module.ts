import { Module } from '@nestjs/common';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { UploadModule } from 'src/upload/upload.module';
import { StoreRepositoryModule } from './store-repository.module';
import { StoreCatalogRepositoryAdapter } from './store-catalog.adapter';
import { StoreCatalogReader } from './store-catalog.reader';
import { StoreCakeWriteContextRepositoryAdapter } from './store-cake-write-context.adapter';
import { StoreCakeWriteContextReader } from './store-cake-write-context.reader';
import { StoreLikeRepositoryAdapter } from './store-like.adapter';
import { StoreLikePort } from './store-like.port';

@Module({
  imports: [UploadModule, StoreRepositoryModule],
  controllers: [StoreController],
  providers: [
    StoreService,
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
    StoreRepositoryModule,
    StoreCatalogReader,
    StoreCakeWriteContextReader,
    StoreLikePort,
  ],
})
export class StoreModule {}
