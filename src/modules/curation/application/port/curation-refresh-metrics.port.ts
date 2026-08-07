export type CurationRunResult = 'success' | 'failure' | 'skipped';
export type CurationItemResult = 'refreshed' | 'skipped' | 'failed';

export abstract class CurationRefreshMetrics {
  abstract countRun(result: CurationRunResult): void;

  abstract countItems(result: CurationItemResult, count: number): void;

  abstract setStaleBacklog(count: number): void;
}
