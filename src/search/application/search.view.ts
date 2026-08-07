import { Cake } from 'src/cake/domain/cake';

export interface SearchResultView {
  readonly cakes: Cake[];
  readonly hasMore: boolean;
  readonly nextPage?: number;
}

export interface LatestSearchView {
  readonly keywords: string[];
}
