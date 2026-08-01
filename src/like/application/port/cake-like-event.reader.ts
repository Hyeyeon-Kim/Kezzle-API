export interface CakeLikeNetCount {
  readonly cakeId: string;
  readonly appLike: number;
}

export abstract class CakeLikeEventReader {
  abstract getNetCounts(
    startDate: string,
    endDate: string,
    maxTimeMs?: number,
  ): Promise<CakeLikeNetCount[]>;
}
