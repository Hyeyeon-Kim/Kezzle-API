import { registerAs } from '@nestjs/config';
import {
  ENV_DEFAULTS,
  strictBoolean,
  strictInteger,
  strictUrl,
} from './environment.validation';

function cachePolicy(
  prefix: string,
  freshDefault: number,
  staleDefault: number,
) {
  return {
    freshTtlMs: strictInteger(
      process.env,
      `HOME_CACHE_${prefix}_FRESH_TTL_MS`,
      freshDefault,
      { min: 1 },
    ),
    staleTtlMs: strictInteger(
      process.env,
      `HOME_CACHE_${prefix}_STALE_TTL_MS`,
      staleDefault,
      { min: 1 },
    ),
  };
}

export default registerAs('home', () => ({
  hardDeadlineMs: strictInteger(
    process.env,
    'HOME_HARD_DEADLINE_MS',
    ENV_DEFAULTS.HOME_HARD_DEADLINE_MS,
    { min: 1 },
  ),
  sectionTimeoutMs: {
    recommendCakes: strictInteger(
      process.env,
      'HOME_RECOMMEND_TIMEOUT_MS',
      ENV_DEFAULTS.HOME_RECOMMEND_TIMEOUT_MS,
      { min: 1 },
    ),
    anniversary: strictInteger(
      process.env,
      'HOME_ANNIVERSARY_TIMEOUT_MS',
      ENV_DEFAULTS.HOME_ANNIVERSARY_TIMEOUT_MS,
      { min: 1 },
    ),
    popularCakes: strictInteger(
      process.env,
      'HOME_POPULAR_TIMEOUT_MS',
      ENV_DEFAULTS.HOME_POPULAR_TIMEOUT_MS,
      { min: 1 },
    ),
    keywordRanks: strictInteger(
      process.env,
      'HOME_KEYWORD_RANKS_TIMEOUT_MS',
      ENV_DEFAULTS.HOME_KEYWORD_RANKS_TIMEOUT_MS,
      { min: 1 },
    ),
    newestCakes: strictInteger(
      process.env,
      'HOME_NEWEST_TIMEOUT_MS',
      ENV_DEFAULTS.HOME_NEWEST_TIMEOUT_MS,
      { min: 1 },
    ),
    curations: strictInteger(
      process.env,
      'HOME_CURATIONS_TIMEOUT_MS',
      ENV_DEFAULTS.HOME_CURATIONS_TIMEOUT_MS,
      { min: 1 },
    ),
  },
  jsonMetricsEnabled: strictBoolean(
    process.env,
    'HOME_RESILIENCE_METRICS_ENABLED',
    false,
  ),
  cache: {
    redisUrl: strictUrl(process.env, 'REDIS_URL', {
      protocols: ['redis:', 'rediss:'],
    }),
    commandTimeoutMs: strictInteger(
      process.env,
      'HOME_CACHE_COMMAND_TIMEOUT_MS',
      ENV_DEFAULTS.HOME_CACHE_COMMAND_TIMEOUT_MS,
      { min: 1 },
    ),
    connectTimeoutMs: strictInteger(
      process.env,
      'HOME_CACHE_CONNECT_TIMEOUT_MS',
      ENV_DEFAULTS.HOME_CACHE_CONNECT_TIMEOUT_MS,
      { min: 1 },
    ),
    lockTtlMs: strictInteger(
      process.env,
      'HOME_CACHE_LOCK_TTL_MS',
      ENV_DEFAULTS.HOME_CACHE_LOCK_TTL_MS,
      { min: 1 },
    ),
    jitterPercent: strictInteger(
      process.env,
      'HOME_CACHE_TTL_JITTER_PERCENT',
      ENV_DEFAULTS.HOME_CACHE_TTL_JITTER_PERCENT,
      { min: 0, max: 100 },
    ),
    policies: {
      anniversary: cachePolicy('ANNIVERSARY', 300000, 1800000),
      recommend: cachePolicy('RECOMMEND', 600000, 3600000),
      popular: cachePolicy('POPULAR', 60000, 600000),
      keywordRanks: cachePolicy('KEYWORD_RANKS', 60000, 600000),
      newest: cachePolicy('NEWEST', 60000, 600000),
      curations: cachePolicy('CURATIONS', 300000, 1800000),
    },
  },
}));
