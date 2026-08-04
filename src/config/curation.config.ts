import { registerAs } from '@nestjs/config';
import { ENV_DEFAULTS, strictInteger } from './environment.validation';

export default registerAs('curation', () => {
  const configuredIntervalMs = strictInteger(
    process.env,
    'CURATION_REFRESH_INTERVAL_MS',
    ENV_DEFAULTS.CURATION_REFRESH_INTERVAL_MS,
    { min: 0 },
  );
  return {
    refreshEnabled: configuredIntervalMs > 0,
    refreshIntervalMs:
      configuredIntervalMs || ENV_DEFAULTS.CURATION_REFRESH_INTERVAL_MS,
    staleMs: strictInteger(
      process.env,
      'CURATION_STALE_MS',
      ENV_DEFAULTS.CURATION_STALE_MS,
      { min: 1 },
    ),
  };
});
