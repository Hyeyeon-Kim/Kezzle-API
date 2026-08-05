import { CakeView } from 'src/modules/cake/application/cake.view';

export interface SearchResultView {
  readonly cakes: CakeView[];
  readonly hasMore: boolean;
  readonly nextPage?: number;
}

export interface LatestSearchView {
  readonly keywords: string[];
}
