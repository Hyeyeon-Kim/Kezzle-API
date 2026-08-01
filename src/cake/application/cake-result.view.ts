import { CakeView } from './cake.view';

export interface CakePageView {
  readonly cakes: CakeView[];
  readonly hasMore: boolean;
}

export interface PopularCakesView {
  readonly cakes: CakeView[];
  readonly startDate: string;
  readonly endDate: string;
}
