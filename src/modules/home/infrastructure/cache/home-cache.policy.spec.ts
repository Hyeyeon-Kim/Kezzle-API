import { homeCachePolicy } from './home-cache.policy';
import { homeConfigFixture } from '../../../../../test/support/typed-config.fixtures';

describe('homeCachePolicy', () => {
  it('selects a section policy from the typed fixture', () => {
    expect(homeCachePolicy(homeConfigFixture.cache.policies, 'newest')).toEqual(
      { freshTtlMs: 60_000, staleTtlMs: 600_000 },
    );
  });
});
