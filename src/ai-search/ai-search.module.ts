import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VitClient } from './vit-client';
import { ClipClient } from './clip-client';

@Module({
  imports: [HttpModule],
  providers: [VitClient, ClipClient],
  exports: [VitClient, ClipClient],
})
export class AiSearchModule {}
