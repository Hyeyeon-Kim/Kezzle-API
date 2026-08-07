export type HomeCachePolicyName =
  | 'anniversary'
  | 'recommend'
  | 'popular'
  | 'keywordRanks'
  | 'newest'
  | 'curations';

export type HomeCacheRequest<T> = {
  keySuffix: string;
  policy: HomeCachePolicyName;
  refresh: () => Promise<T>;
};

export abstract class HomeCachePort {
  abstract getWithSwr<T>(request: HomeCacheRequest<T>): Promise<T>;

  abstract healthStatus(): 'up' | 'down' | 'disabled';
}
