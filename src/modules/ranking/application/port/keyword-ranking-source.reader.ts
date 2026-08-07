export interface KeywordRankingCount {
  readonly _id: string;
  readonly count: number;
}

export abstract class KeywordRankingSourceReader {
  abstract getRanked(
    startDate: string,
    endDate: string,
    limit?: number,
    maxTimeMs?: number,
  ): Promise<KeywordRankingCount[]>;
}
