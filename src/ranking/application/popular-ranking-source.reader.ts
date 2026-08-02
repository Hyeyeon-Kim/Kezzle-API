import { ImageValue } from 'src/common/image/application/image.value';

export interface PopularRankingCandidate {
  readonly cakeId: string;
  readonly total: number;
  readonly image: ImageValue;
  readonly ownerStoreId: string;
  readonly tags: readonly string[];
}

export interface PopularRankingSourceQuery {
  readonly start: Date;
  readonly end: Date;
  readonly limit: number;
  readonly maxTimeMs: number;
}

export abstract class PopularRankingSourceReader {
  abstract findTop(
    query: PopularRankingSourceQuery,
  ): Promise<PopularRankingCandidate[]>;
}
