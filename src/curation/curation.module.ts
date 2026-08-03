import { Module } from '@nestjs/common';
import { CurationController } from './curation.controller';
import { CurationService } from './curation.service';
import { Curation, CurationSchema } from './entities/curation.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { CurationRefreshService } from './curation-refresh.service';
import { AiSearchModule } from 'src/ai-search/ai-search.module';
import { CurationQueryService } from './curation-query.service';
import { CurationRepository } from './curation.repository';
import { MonitoringModule } from 'src/monitoring/monitoring.module';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: Curation.name, schema: CurationSchema }],
      'kezzle',
    ),
    AiSearchModule,
    MonitoringModule,
  ],
  controllers: [CurationController],
  providers: [
    CurationRepository,
    CurationService,
    CurationQueryService,
    CurationRefreshService,
  ],
  exports: [CurationQueryService],
})
export class CurationModule {}
