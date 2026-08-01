import { CakeView } from 'src/cake/application/cake.view';

export interface SearchResultView {
  readonly cakes: CakeView[];
  readonly hasMore: boolean;
  readonly nextPage?: number;
}

export interface SearchRankItemView {
  readonly id: string;
  readonly count: number;
}

export interface SearchRankView {
  readonly ranking: SearchRankItemView[];
  readonly startDate: string;
  readonly endDate: string;
}

export interface LatestSearchView {
  readonly keywords: string[];
}
