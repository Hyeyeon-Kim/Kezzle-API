import { Module } from '@nestjs/common';
import { AnniversaryService } from 'src/modules/anniversary/application/query/anniversary.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Anniversary,
  AnniversarySchema,
} from 'src/modules/anniversary/infrastructure/persistence/schema/anniversary.schema';
import { AiSearchModule } from 'src/integrations/ai-search/ai-search.module';
import { AnniversaryRepository } from 'src/modules/anniversary/infrastructure/persistence/anniversary.repository';
import { AnniversaryRepositoryPort } from './application/port/anniversary-repository.port';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Anniversary.name, schema: AnniversarySchema }],
      'kezzle',
    ),
    AiSearchModule,
  ],
  providers: [
    AnniversaryService,
    AnniversaryRepository,
    {
      provide: AnniversaryRepositoryPort,
      useExisting: AnniversaryRepository,
    },
  ],
  exports: [AnniversaryService],
})
export class AnniversaryModule {}
