import { ObjectStorageOperation } from './object-storage.error';

export type MediaFeature = 'cake' | 'store';

export abstract class MediaMetricsPort {
  abstract countStorageFailure(operation: ObjectStorageOperation): void;
  abstract countOrphan(feature: MediaFeature, operation: string): void;
}
