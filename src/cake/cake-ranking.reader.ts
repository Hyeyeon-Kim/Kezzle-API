import { ImageValue } from 'src/common/image/application/image.value';

export interface CakeRankingView {
  readonly id: string;
  readonly image: ImageValue;
  readonly ownerStoreId: string;
  readonly likeText?: string;
  readonly tags: readonly string[];
}

export abstract class CakeRankingReader {
  abstract findByIds(cakeIds: string[]): Promise<CakeRankingView[]>;
}
