import { Module } from '@nestjs/common';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { UploadModule } from 'src/upload/upload.module';
import { StoreRepositoryModule } from './store-repository.module';
import { StoreCatalogRepositoryAdapter } from './store-catalog.adapter';
import { StoreCatalogReader } from './store-catalog.reader';

@Module({
  imports: [UploadModule, StoreRepositoryModule],
  controllers: [StoreController],
  providers: [
    StoreService,
    StoreCatalogRepositoryAdapter,
    { provide: StoreCatalogReader, useExisting: StoreCatalogRepositoryAdapter },
  ],
  exports: [StoreService, StoreRepositoryModule, StoreCatalogReader],
})
export class StoreModule {}
