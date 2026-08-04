import inventory from '../../test/fixtures/environment-inventory.contract.json';
import {
  optionalPair,
  requiredString,
  strictBoolean,
  strictInteger,
  strictUrl,
  validateEnvironment,
} from './environment.validation';

function validEnvironment(): Record<string, string> {
  return {
    NODE_ENV: 'test',
    MONGODB_URL: 'mongodb://mongo:27017',
    MONGODB_DBNAME_MAIN: 'kezzle-test',
    FIREBASE_PROJECT_ID: 'kezzle-test',
    FIREBASE_PRIVATE_KEY:
      '-----BEGIN PRIVATE KEY-----\\nplaceholder\\n-----END PRIVATE KEY-----',
    FIREBASE_CLIENT_EMAIL: 'firebase@example.com',
    A_BUCKET_NAME: 'kezzle-test',
    A_REGION: 'ap-northeast-2',
  };
}

describe('environment validation contract', () => {
  it('keeps a unique required/optional/default inventory fixture', () => {
    const names = inventory.map((item) => item.name);
    expect(new Set(names).size).toBe(names.length);
    expect(inventory).toHaveLength(52);
    expect(
      inventory
        .filter((item) => item.requirement === 'required')
        .map((item) => item.name),
    ).toEqual([
      'NODE_ENV',
      'MONGODB_URL',
      'MONGODB_DBNAME_MAIN',
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'A_BUCKET_NAME',
      'A_REGION',
    ]);
  });

  it('accepts non-secret placeholders and applies defaults only when absent', () => {
    expect(validateEnvironment(validEnvironment())).toEqual(validEnvironment());
    expect(strictInteger({}, 'PORT', 3000, { min: 1 })).toBe(3000);
    expect(strictBoolean({}, 'FLAG', false)).toBe(false);
  });

  it.each([
    'NODE_ENV',
    'MONGODB_URL',
    'MONGODB_DBNAME_MAIN',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL',
    'A_BUCKET_NAME',
    'A_REGION',
  ])('reports a missing required variable before bootstrap: %s', (name) => {
    const environment = validEnvironment();
    delete environment[name];
    expect(() => validateEnvironment(environment)).toThrow(name);
  });

  it.each([
    ['PORT', '3.14'],
    ['PORT', 'abc'],
    ['HOME_CACHE_TTL_JITTER_PERCENT', '101'],
    ['CURATION_REFRESH_INTERVAL_MS', '-1'],
  ])(
    'rejects invalid integer %s=%s instead of using a default',
    (name, value) => {
      expect(() =>
        validateEnvironment({ ...validEnvironment(), [name]: value }),
      ).toThrow(name);
    },
  );

  it.each([
    ['DEVELOPMENT_AUTH_BYPASS', 'yes'],
    ['HOME_RESILIENCE_AUTH_BYPASS', '1'],
    ['HOME_RESILIENCE_METRICS_ENABLED', 'TRUE'],
  ])('rejects invalid boolean %s=%s', (name, value) => {
    expect(() =>
      validateEnvironment({ ...validEnvironment(), [name]: value }),
    ).toThrow(name);
  });

  it.each([
    ['MONGODB_URL', 'https://mongo.example.com'],
    ['REDIS_URL', 'http://redis.example.com'],
    ['VIT_API_BASE_URL', 'not-a-url'],
  ])('rejects invalid URL %s=%s', (name, value) => {
    expect(() =>
      validateEnvironment({ ...validEnvironment(), [name]: value }),
    ).toThrow(name);
  });

  it('requires optional credentials as complete pairs', () => {
    expect(() =>
      validateEnvironment({ ...validEnvironment(), MONGODB_USERNAME: 'user' }),
    ).toThrow('MONGODB_USERNAME and MONGODB_PASSWORD');
    expect(() =>
      validateEnvironment({ ...validEnvironment(), A_ACCESS_KEY_ID: 'key' }),
    ).toThrow('A_ACCESS_KEY_ID and A_SECRET_ACCESS_KEY');
  });

  it('forbids every authentication bypass in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment(),
        NODE_ENV: 'production',
        DEVELOPMENT_AUTH_BYPASS: 'true',
      }),
    ).toThrow('DEVELOPMENT_AUTH_BYPASS');
    expect(() =>
      validateEnvironment({
        ...validEnvironment(),
        NODE_ENV: 'production',
        HOME_RESILIENCE_AUTH_BYPASS: 'true',
      }),
    ).toThrow('HOME_RESILIENCE_AUTH_BYPASS');
  });

  it('exposes strict primitive validators without mutating global env', () => {
    const environment = {
      TEXT: ' value ',
      BOOL: 'true',
      INT: '12',
      URL: 'https://example.com',
      A: 'x',
      B: 'y',
    };
    expect(requiredString(environment, 'TEXT')).toBe('value');
    expect(strictBoolean(environment, 'BOOL', false)).toBe(true);
    expect(strictInteger(environment, 'INT', 1, { min: 1 })).toBe(12);
    expect(strictUrl(environment, 'URL', { protocols: ['https:'] })).toBe(
      'https://example.com',
    );
    expect(optionalPair(environment, 'A', 'B')).toEqual(['x', 'y']);
  });
});
