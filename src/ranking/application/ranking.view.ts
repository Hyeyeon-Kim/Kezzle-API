import { CakeView } from 'src/cake/application/cake.view';

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
  readonly cakes: CakeView[];
  readonly startDate: string;
  readonly endDate: string;
}
