export interface RankedKeywords {
  readonly ranking: { readonly _id: string; readonly count: number }[];
  readonly startDate: string;
  readonly endDate: string;
}

export abstract class KeywordRankReadModelPort {
  abstract getRanked(
    limit: number,
    maxTimeMs?: number,
  ): Promise<RankedKeywords>;
}
