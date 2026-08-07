export abstract class CatalogMetrics {
  abstract startSimilarSearch(): (status: 'success' | 'error') => void;
  abstract startStoreQuery(): () => void;
}
