import { Cake } from 'src/modules/cake/application/model/cake';

export interface RankedPopularCakes {
  readonly cakes: Cake[];
  readonly startDate: string;
  readonly endDate: string;
}

export abstract class PopularRankReadModelPort {
  abstract getRanked(
    after: number,
    limit: number,
    maxTimeMs?: number,
  ): Promise<RankedPopularCakes>;
}
