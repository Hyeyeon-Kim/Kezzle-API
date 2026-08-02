export interface SearchHistoryEntry {
  readonly searchWord?: string;
}

export abstract class SearchHistoryReader {
  abstract findLatest(userId: string): Promise<SearchHistoryEntry[]>;
}
