export type ObjectStorageOperation = 'put' | 'delete';

export class ObjectStorageError extends Error {
  constructor(
    readonly operation: ObjectStorageOperation,
    readonly key: string,
    readonly cause: unknown,
  ) {
    super(`Object storage ${operation} failed for key: ${key}`);
    this.name = ObjectStorageError.name;
  }
}
