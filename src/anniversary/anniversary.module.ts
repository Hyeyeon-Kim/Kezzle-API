import { Module } from '@nestjs/common';
import { AnniversaryService } from 'src/anniversary/application/query/anniversary.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Anniversary,
  AnniversarySchema,
} from 'src/anniversary/infrastructure/persistence/schema/anniversary.schema';
import { AiSearchModule } from 'src/ai-search/ai-search.module';
import { AnniversaryRepository } from 'src/anniversary/infrastructure/persistence/anniversary.repository';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Anniversary.name, schema: AnniversarySchema }],
      'kezzle',
    ),
    AiSearchModule,
  ],
  providers: [AnniversaryService, AnniversaryRepository],
  exports: [AnniversaryService],
})
export class AnniversaryModule {}
