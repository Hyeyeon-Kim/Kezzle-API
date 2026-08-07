import { Cake } from 'src/cake/domain/cake';

export interface KeywordRankItemView {
  readonly id: string;
  readonly count: number;
}

export interface KeywordRankingView {
  readonly ranking: KeywordRankItemView[];
  readonly startDate: string;
  readonly endDate: string;
}

export interface PopularRankingView {
  readonly cakes: Cake[];
  readonly startDate: string;
  readonly endDate: string;
}
