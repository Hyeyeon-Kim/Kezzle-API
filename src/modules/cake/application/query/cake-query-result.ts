import { Cake } from '../model/cake';

export interface CakeQueryResult {
  readonly cakes: Cake[];
  readonly hasMore: boolean;
}
