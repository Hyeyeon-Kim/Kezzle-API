import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cake, CakeSchema } from './entities/cake.schema';
import { CakeService } from './cake.service';
import { SimilarCakeService } from './similar-cake.service';
import { CakeRepository } from './cake.repository';
import { CakeController } from './cake.controller';
import { Store, StoreSchema } from 'src/store/entities/store.schema';
import { UploadModule } from '../upload/upload.module';
import { LogModule } from 'src/log/log.module';
import { AnniversaryModule } from 'src/anniversary/anniversary.module';
import { CounterModule } from 'src/counter/counter.module';
import { MetricsModule } from 'src/metrics/metrics.module';
import { AiSearchModule } from 'src/ai-search/ai-search.module';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Cake.name, schema: CakeSchema }],
      'kezzle',
    ),
    MongooseModule.forFeature(
      [{ name: Store.name, schema: StoreSchema }],
      'kezzle',
    ),
    UploadModule,
    LogModule,
    AnniversaryModule,
    CounterModule,
    MetricsModule,
    AiSearchModule,
  ],
  controllers: [CakeController],
  providers: [CakeService, SimilarCakeService, CakeRepository],
  exports: [CakeService, CakeRepository],
})
export class CakeModule {}
