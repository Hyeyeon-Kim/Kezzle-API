import { CakeView } from './cake.view';

export interface CakePageView {
  readonly cakes: CakeView[];
  readonly hasMore: boolean;
}
