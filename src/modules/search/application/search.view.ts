import { Cake } from 'src/modules/cake/application/model/cake';

export interface SearchResultView {
  readonly cakes: Cake[];
  readonly hasMore: boolean;
  readonly nextPage?: number;
}

export interface LatestSearchView {
  readonly keywords: string[];
}
