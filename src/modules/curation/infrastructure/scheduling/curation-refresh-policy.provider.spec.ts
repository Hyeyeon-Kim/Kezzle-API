import { createCurationRefreshPolicy } from './curation-refresh-policy.provider';

describe('CurationRefreshPolicyProvider', () => {
  it('keeps the claim beyond the AI timeout when the schedule is shorter', () => {
    const policy = createCurationRefreshPolicy(
      { staleMs: 60_000, refreshIntervalMs: 1_000 },
      { httpTimeoutMs: 5_000 },
    );

    expect(policy).toEqual({ staleMs: 60_000, claimTtlMs: 10_000 });
  });

  it('keeps the scheduling interval as the claim TTL when it is longer', () => {
    const policy = createCurationRefreshPolicy(
      { staleMs: 60_000, refreshIntervalMs: 600_000 },
      { httpTimeoutMs: 5_000 },
    );

    expect(policy).toEqual({ staleMs: 60_000, claimTtlMs: 600_000 });
  });
});
