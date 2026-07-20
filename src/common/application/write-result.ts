export interface WriteResult {
  readonly acknowledged: boolean;
  readonly matchedCount?: number;
  readonly modifiedCount?: number;
  readonly deletedCount?: number;
}
