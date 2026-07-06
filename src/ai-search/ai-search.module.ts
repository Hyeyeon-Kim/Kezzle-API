import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VitClient } from './vit-client';
import { ClipClient } from './clip-client';
import { MetricsModule } from 'src/metrics/metrics.module';

@Module({
  imports: [HttpModule, MetricsModule],
  providers: [VitClient, ClipClient],
  exports: [VitClient, ClipClient],
})
export class AiSearchModule {}
