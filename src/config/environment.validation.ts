export type RuntimeEnvironment = 'development' | 'test' | 'production';

type Environment = Record<string, unknown>;

const DEFAULTS = {
  PORT: 3000,
  SHUTDOWN_DRAIN_MS: 1000,
  VIT_API_BASE_URL: 'https://api.kezzlecake.com/vit',
  CLIP_API_BASE_URL: 'https://api.kezzlecake.com/clip',
  AI_HTTP_TIMEOUT_MS: 5000,
  HOME_HARD_DEADLINE_MS: 600,
  HOME_RECOMMEND_TIMEOUT_MS: 250,
  HOME_ANNIVERSARY_TIMEOUT_MS: 250,
  HOME_POPULAR_TIMEOUT_MS: 50,
  HOME_KEYWORD_RANKS_TIMEOUT_MS: 400,
  HOME_NEWEST_TIMEOUT_MS: 100,
  HOME_CURATIONS_TIMEOUT_MS: 100,
  HOME_CACHE_COMMAND_TIMEOUT_MS: 80,
  HOME_CACHE_CONNECT_TIMEOUT_MS: 1000,
  HOME_CACHE_LOCK_TTL_MS: 10000,
  HOME_CACHE_TTL_JITTER_PERCENT: 10,
  KEYWORD_RANK_WINDOW_DAYS: 30,
  POPULAR_RANK_WINDOW_DAYS: 30,
  KEYWORD_RANK_TTL_MS: 600000,
  POPULAR_RANK_TTL_MS: 600000,
  POPULAR_RANK_SOURCE_MAX_TIME_MS: 5000,
  CURATION_REFRESH_INTERVAL_MS: 600000,
  CURATION_STALE_MS: 3 * 24 * 60 * 60 * 1000,
} as const;

export const ENV_DEFAULTS = Object.freeze(DEFAULTS);

export function requiredString(environment: Environment, name: string): string {
  const value = environment[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

export function optionalString(
  environment: Environment,
  name: string,
): string | undefined {
  const value = environment[name];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value.trim();
}

export function strictBoolean(
  environment: Environment,
  name: string,
  defaultValue: boolean,
): boolean {
  const value = environment[name];
  if (value === undefined || value === null) return defaultValue;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  throw new Error(`${name} must be either true or false`);
}

export function strictInteger(
  environment: Environment,
  name: string,
  defaultValue: number,
  options: { min?: number; max?: number } = {},
): number {
  const value = environment[name];
  if (value === undefined || value === null) return defaultValue;
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^-?\d+$/.test(text)) {
    throw new Error(`${name} must be an integer`);
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a safe integer`);
  }
  if (options.min !== undefined && parsed < options.min) {
    throw new Error(`${name} must be greater than or equal to ${options.min}`);
  }
  if (options.max !== undefined && parsed > options.max) {
    throw new Error(`${name} must be less than or equal to ${options.max}`);
  }
  return parsed;
}

export function strictUrl(
  environment: Environment,
  name: string,
  options: { defaultValue?: string; protocols: readonly string[] },
): string | undefined {
  const raw = optionalString(environment, name) ?? options.defaultValue;
  if (raw === undefined) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  if (!options.protocols.includes(url.protocol)) {
    throw new Error(`${name} must use ${options.protocols.join(' or ')}`);
  }
  return url.toString().replace(/\/$/, '');
}

export function optionalPair(
  environment: Environment,
  firstName: string,
  secondName: string,
): readonly [string | undefined, string | undefined] {
  const first = optionalString(environment, firstName);
  const second = optionalString(environment, secondName);
  if (Boolean(first) !== Boolean(second)) {
    throw new Error(
      `${firstName} and ${secondName} must be configured together`,
    );
  }
  return [first, second];
}

function runtimeEnvironment(environment: Environment): RuntimeEnvironment {
  const value = requiredString(environment, 'NODE_ENV');
  if (!['development', 'test', 'production'].includes(value)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }
  return value as RuntimeEnvironment;
}

function validatePrivateKey(environment: Environment): void {
  const privateKey = requiredString(
    environment,
    'FIREBASE_PRIVATE_KEY',
  ).replace(/\\n/g, '\n');
  if (
    !privateKey.includes('-----BEGIN PRIVATE KEY-----') ||
    !privateKey.includes('-----END PRIVATE KEY-----')
  ) {
    throw new Error('FIREBASE_PRIVATE_KEY must be a PEM private key');
  }
}

function validateEmail(environment: Environment): void {
  const email = requiredString(environment, 'FIREBASE_CLIENT_EMAIL');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('FIREBASE_CLIENT_EMAIL must be a valid email address');
  }
}

function validateCachePolicy(
  environment: Environment,
  prefix: string,
  freshDefault: number,
  staleDefault: number,
): void {
  const freshName = `HOME_CACHE_${prefix}_FRESH_TTL_MS`;
  const staleName = `HOME_CACHE_${prefix}_STALE_TTL_MS`;
  const fresh = strictInteger(environment, freshName, freshDefault, { min: 1 });
  const stale = strictInteger(environment, staleName, staleDefault, { min: 1 });
  if (fresh > stale) {
    throw new Error(`${freshName} must be less than or equal to ${staleName}`);
  }
}

export function validateEnvironment(
  environment: Environment = process.env,
): Environment {
  const errors: string[] = [];
  const check = (validation: () => void) => {
    try {
      validation();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  };

  let nodeEnv: RuntimeEnvironment | undefined;
  check(() => {
    nodeEnv = runtimeEnvironment(environment);
  });
  check(
    () =>
      void strictInteger(environment, 'PORT', DEFAULTS.PORT, {
        min: 1,
        max: 65535,
      }),
  );
  check(
    () =>
      void strictInteger(
        environment,
        'SHUTDOWN_DRAIN_MS',
        DEFAULTS.SHUTDOWN_DRAIN_MS,
        { min: 0 },
      ),
  );
  check(() => {
    requiredString(environment, 'MONGODB_URL');
    strictUrl(environment, 'MONGODB_URL', {
      protocols: ['mongodb:', 'mongodb+srv:'],
    });
  });
  check(() => void requiredString(environment, 'MONGODB_DBNAME_MAIN'));
  check(
    () =>
      void optionalPair(environment, 'MONGODB_USERNAME', 'MONGODB_PASSWORD'),
  );
  check(() => void requiredString(environment, 'FIREBASE_PROJECT_ID'));
  check(() => validatePrivateKey(environment));
  check(() => validateEmail(environment));
  check(() => void requiredString(environment, 'A_BUCKET_NAME'));
  check(() => void requiredString(environment, 'A_REGION'));
  check(
    () =>
      void optionalPair(environment, 'A_ACCESS_KEY_ID', 'A_SECRET_ACCESS_KEY'),
  );
  check(
    () =>
      void strictUrl(environment, 'VIT_API_BASE_URL', {
        defaultValue: DEFAULTS.VIT_API_BASE_URL,
        protocols: ['http:', 'https:'],
      }),
  );
  check(
    () =>
      void strictUrl(environment, 'CLIP_API_BASE_URL', {
        defaultValue: DEFAULTS.CLIP_API_BASE_URL,
        protocols: ['http:', 'https:'],
      }),
  );
  check(
    () =>
      void strictInteger(
        environment,
        'AI_HTTP_TIMEOUT_MS',
        DEFAULTS.AI_HTTP_TIMEOUT_MS,
        { min: 1 },
      ),
  );
  check(
    () =>
      void strictUrl(environment, 'REDIS_URL', {
        protocols: ['redis:', 'rediss:'],
      }),
  );

  const positiveIntegers = [
    'HOME_HARD_DEADLINE_MS',
    'HOME_RECOMMEND_TIMEOUT_MS',
    'HOME_ANNIVERSARY_TIMEOUT_MS',
    'HOME_POPULAR_TIMEOUT_MS',
    'HOME_KEYWORD_RANKS_TIMEOUT_MS',
    'HOME_NEWEST_TIMEOUT_MS',
    'HOME_CURATIONS_TIMEOUT_MS',
    'HOME_CACHE_COMMAND_TIMEOUT_MS',
    'HOME_CACHE_CONNECT_TIMEOUT_MS',
    'HOME_CACHE_LOCK_TTL_MS',
    'KEYWORD_RANK_WINDOW_DAYS',
    'POPULAR_RANK_WINDOW_DAYS',
    'KEYWORD_RANK_TTL_MS',
    'POPULAR_RANK_TTL_MS',
    'POPULAR_RANK_SOURCE_MAX_TIME_MS',
    'CURATION_STALE_MS',
  ] as const;
  positiveIntegers.forEach((name) =>
    check(
      () => void strictInteger(environment, name, DEFAULTS[name], { min: 1 }),
    ),
  );
  check(
    () =>
      void strictInteger(
        environment,
        'CURATION_REFRESH_INTERVAL_MS',
        DEFAULTS.CURATION_REFRESH_INTERVAL_MS,
        { min: 0 },
      ),
  );
  check(
    () =>
      void strictInteger(
        environment,
        'HOME_CACHE_TTL_JITTER_PERCENT',
        DEFAULTS.HOME_CACHE_TTL_JITTER_PERCENT,
        { min: 0, max: 100 },
      ),
  );

  check(() => validateCachePolicy(environment, 'ANNIVERSARY', 300000, 1800000));
  check(() => validateCachePolicy(environment, 'RECOMMEND', 600000, 3600000));
  check(() => validateCachePolicy(environment, 'POPULAR', 60000, 600000));
  check(() => validateCachePolicy(environment, 'KEYWORD_RANKS', 60000, 600000));
  check(() => validateCachePolicy(environment, 'NEWEST', 60000, 600000));
  check(() => validateCachePolicy(environment, 'CURATIONS', 300000, 1800000));

  let developmentBypass = false;
  let homeBypass = false;
  check(() => {
    developmentBypass = strictBoolean(
      environment,
      'DEVELOPMENT_AUTH_BYPASS',
      false,
    );
  });
  check(() => {
    homeBypass = strictBoolean(
      environment,
      'HOME_RESILIENCE_AUTH_BYPASS',
      false,
    );
  });
  check(
    () =>
      void strictBoolean(environment, 'HOME_RESILIENCE_METRICS_ENABLED', false),
  );
  if (nodeEnv === 'production' && (developmentBypass || homeBypass)) {
    errors.push(
      'DEVELOPMENT_AUTH_BYPASS and HOME_RESILIENCE_AUTH_BYPASS must be disabled in production',
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n- ${errors.join('\n- ')}`,
    );
  }
  return environment;
}
