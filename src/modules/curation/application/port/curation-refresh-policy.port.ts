export abstract class CurationRefreshPolicy {
  abstract readonly staleMs: number;

  abstract readonly claimTtlMs: number;
}
