import {
  homeCachePolicy,
  validateHomeCachePolicies,
} from './home-cache.policy';

describe('homeCachePolicy', () => {
  afterEach(() => {
    delete process.env.HOME_CACHE_NEWEST_FRESH_TTL_MS;
    delete process.env.HOME_CACHE_NEWEST_STALE_TTL_MS;
  });

  it('reads section TTL values from the environment', () => {
    process.env.HOME_CACHE_NEWEST_FRESH_TTL_MS = '2000';
    process.env.HOME_CACHE_NEWEST_STALE_TTL_MS = '9000';

    expect(homeCachePolicy('newest')).toEqual({
      freshTtlMs: 2_000,
      staleTtlMs: 9_000,
    });
  });

  it('rejects a fresh TTL greater than the stale TTL', () => {
    process.env.HOME_CACHE_NEWEST_FRESH_TTL_MS = '10000';
    process.env.HOME_CACHE_NEWEST_STALE_TTL_MS = '1000';

    expect(() => validateHomeCachePolicies()).toThrow(
      'HOME_CACHE_NEWEST_FRESH_TTL_MS must be less than or equal to HOME_CACHE_NEWEST_STALE_TTL_MS',
    );
  });
});
