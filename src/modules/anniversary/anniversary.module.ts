import { Module } from '@nestjs/common';
import { AnniversaryService } from './anniversary.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Anniversary, AnniversarySchema } from './entities/anniversary.schema';
import { AiSearchModule } from 'src/integrations/ai-search/ai-search.module';
import { AnniversaryRepository } from './anniversary.repository';

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
