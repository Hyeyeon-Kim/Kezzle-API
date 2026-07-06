import { positiveEnvMs } from './swr';

type HomeCachePolicy = {
  freshTtlMs: number;
  staleTtlMs: number;
};

const POLICY_CONFIG = {
  anniversary: {
    freshEnv: 'HOME_CACHE_ANNIVERSARY_FRESH_TTL_MS',
    staleEnv: 'HOME_CACHE_ANNIVERSARY_STALE_TTL_MS',
    freshDefaultMs: 5 * 60 * 1000,
    staleDefaultMs: 30 * 60 * 1000,
  },
  recommend: {
    freshEnv: 'HOME_CACHE_RECOMMEND_FRESH_TTL_MS',
    staleEnv: 'HOME_CACHE_RECOMMEND_STALE_TTL_MS',
    freshDefaultMs: 10 * 60 * 1000,
    staleDefaultMs: 60 * 60 * 1000,
  },
  popular: {
    freshEnv: 'HOME_CACHE_POPULAR_FRESH_TTL_MS',
    staleEnv: 'HOME_CACHE_POPULAR_STALE_TTL_MS',
    freshDefaultMs: 60 * 1000,
    staleDefaultMs: 10 * 60 * 1000,
  },
  keywordRanks: {
    freshEnv: 'HOME_CACHE_KEYWORD_RANKS_FRESH_TTL_MS',
    staleEnv: 'HOME_CACHE_KEYWORD_RANKS_STALE_TTL_MS',
    freshDefaultMs: 60 * 1000,
    staleDefaultMs: 10 * 60 * 1000,
  },
  newest: {
    freshEnv: 'HOME_CACHE_NEWEST_FRESH_TTL_MS',
    staleEnv: 'HOME_CACHE_NEWEST_STALE_TTL_MS',
    freshDefaultMs: 60 * 1000,
    staleDefaultMs: 10 * 60 * 1000,
  },
  curations: {
    freshEnv: 'HOME_CACHE_CURATIONS_FRESH_TTL_MS',
    staleEnv: 'HOME_CACHE_CURATIONS_STALE_TTL_MS',
    freshDefaultMs: 5 * 60 * 1000,
    staleDefaultMs: 30 * 60 * 1000,
  },
} as const;

type HomeCachePolicyName = keyof typeof POLICY_CONFIG;

export function homeCachePolicy(name: HomeCachePolicyName): HomeCachePolicy {
  const config = POLICY_CONFIG[name];
  const freshTtlMs = positiveEnvMs(config.freshEnv, config.freshDefaultMs);
  const staleTtlMs = positiveEnvMs(config.staleEnv, config.staleDefaultMs);

  if (freshTtlMs > staleTtlMs) {
    throw new Error(
      `${config.freshEnv} must be less than or equal to ${config.staleEnv}`,
    );
  }

  return {
    freshTtlMs,
    staleTtlMs,
  };
}

export function validateHomeCachePolicies(): void {
  (Object.keys(POLICY_CONFIG) as HomeCachePolicyName[]).forEach((name) =>
    homeCachePolicy(name),
  );
}
