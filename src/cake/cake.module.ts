import { Module } from '@nestjs/common';
import { CakeService } from './cake.service';
import { CakeRepositoryModule } from './cake-repository.module';
import { CakeController } from './cake.controller';
import { UploadModule } from '../upload/upload.module';
import { LogModule } from 'src/log/log.module';
import { AnniversaryModule } from 'src/anniversary/anniversary.module';
import { CounterModule } from 'src/counter/counter.module';
import { AiSearchModule } from 'src/ai-search/ai-search.module';
import { StoreRepositoryModule } from 'src/store/store-repository.module';
import { CakeCatalogRepositoryAdapter } from './cake-catalog.adapter';
import { CakeCatalogReader } from './cake-catalog.reader';

@Module({
  imports: [
    UploadModule,
    LogModule,
    AnniversaryModule,
    CounterModule,
    AiSearchModule,
    CakeRepositoryModule,
    StoreRepositoryModule,
  ],
  controllers: [CakeController],
  providers: [
    CakeService,
    CakeCatalogRepositoryAdapter,
    { provide: CakeCatalogReader, useExisting: CakeCatalogRepositoryAdapter },
  ],
  exports: [CakeService, CakeRepositoryModule, CakeCatalogReader],
})
export class CakeModule {}
