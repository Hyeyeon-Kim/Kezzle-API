import { Module } from '@nestjs/common';
import { CakeRankingRepositoryAdapter } from './cake-ranking.adapter';
import { CakeRankingReader } from './cake-ranking.reader';
import { CakeRepositoryModule } from './cake-repository.module';

@Module({
  imports: [CakeRepositoryModule],
  providers: [
    CakeRankingRepositoryAdapter,
    {
      provide: CakeRankingReader,
      useExisting: CakeRankingRepositoryAdapter,
    },
  ],
  exports: [CakeRankingReader],
})
export class CakeRankingModule {}
