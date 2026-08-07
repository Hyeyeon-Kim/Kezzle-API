import { Cake } from '../../domain/cake';

export interface CakeQueryResult {
  readonly cakes: Cake[];
  readonly hasMore: boolean;
}
