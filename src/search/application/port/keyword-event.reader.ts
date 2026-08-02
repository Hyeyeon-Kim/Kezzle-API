export interface KeywordEventCount {
  readonly _id: string;
  readonly count: number;
}

export abstract class KeywordEventReader {
  abstract getRanked(
    startDate: string,
    endDate: string,
    limit?: number,
    maxTimeMs?: number,
  ): Promise<KeywordEventCount[]>;
}
