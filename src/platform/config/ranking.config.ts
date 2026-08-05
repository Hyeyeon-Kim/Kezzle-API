import { registerAs } from '@nestjs/config';
import { ENV_DEFAULTS, strictInteger } from './environment.validation';

export default registerAs('ranking', () => ({
  keywordWindowDays: strictInteger(
    process.env,
    'KEYWORD_RANK_WINDOW_DAYS',
    ENV_DEFAULTS.KEYWORD_RANK_WINDOW_DAYS,
    { min: 1 },
  ),
  popularWindowDays: strictInteger(
    process.env,
    'POPULAR_RANK_WINDOW_DAYS',
    ENV_DEFAULTS.POPULAR_RANK_WINDOW_DAYS,
    { min: 1 },
  ),
  keywordTtlMs: strictInteger(
    process.env,
    'KEYWORD_RANK_TTL_MS',
    ENV_DEFAULTS.KEYWORD_RANK_TTL_MS,
    { min: 1 },
  ),
  popularTtlMs: strictInteger(
    process.env,
    'POPULAR_RANK_TTL_MS',
    ENV_DEFAULTS.POPULAR_RANK_TTL_MS,
    { min: 1 },
  ),
  popularSourceMaxTimeMs: strictInteger(
    process.env,
    'POPULAR_RANK_SOURCE_MAX_TIME_MS',
    ENV_DEFAULTS.POPULAR_RANK_SOURCE_MAX_TIME_MS,
    { min: 1 },
  ),
}));
