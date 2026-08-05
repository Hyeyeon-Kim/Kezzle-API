export type HomeCachePolicy = {
  freshTtlMs: number;
  staleTtlMs: number;
};

export type HomeCachePolicies = Record<
  | 'anniversary'
  | 'recommend'
  | 'popular'
  | 'keywordRanks'
  | 'newest'
  | 'curations',
  HomeCachePolicy
>;

export type HomeCachePolicyName = keyof HomeCachePolicies;

export function homeCachePolicy(
  policies: HomeCachePolicies,
  name: HomeCachePolicyName,
): HomeCachePolicy {
  return policies[name];
}
