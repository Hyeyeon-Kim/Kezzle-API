export abstract class SearchEventRecorder {
  abstract record(
    userId: string,
    searchWord: string,
    relatedWord: string[],
  ): Promise<void>;
}
