import { Module } from '@nestjs/common';
import { CakeService } from './cake.service';
import { CakeRepositoryModule } from './cake-repository.module';
import { CakeController } from './cake.controller';
import { UploadModule } from '../upload/upload.module';
import { LogModule } from 'src/log/log.module';
import { AnniversaryModule } from 'src/anniversary/anniversary.module';
import { CounterModule } from 'src/counter/counter.module';
import { AiSearchModule } from 'src/ai-search/ai-search.module';
import { StoreModule } from 'src/store/store.module';
import { CakeCatalogRepositoryAdapter } from './cake-catalog.adapter';
import { CakeCatalogReader } from './cake-catalog.reader';
import { CakeLikeRepositoryAdapter } from './cake-like.adapter';
import { CakeLikePort } from './cake-like.port';

@Module({
  imports: [
    UploadModule,
    LogModule,
    AnniversaryModule,
    CounterModule,
    AiSearchModule,
    CakeRepositoryModule,
    StoreModule,
  ],
  controllers: [CakeController],
  providers: [
    CakeService,
    CakeCatalogRepositoryAdapter,
    { provide: CakeCatalogReader, useExisting: CakeCatalogRepositoryAdapter },
    CakeLikeRepositoryAdapter,
    { provide: CakeLikePort, useExisting: CakeLikeRepositoryAdapter },
  ],
  exports: [CakeService, CakeCatalogReader, CakeLikePort],
})
export class CakeModule {}
