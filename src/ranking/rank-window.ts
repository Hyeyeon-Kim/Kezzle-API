const DAY_MS = 24 * 60 * 60 * 1000;
export type RankWindow = {
  start: Date;
  end: Date;
  // 응답 startDate/endDate 표시용 (YYYY-MM-DD)
  startDate: string;
  endDate: string;
};

// 랭킹 집계 구간. 조회/갱신 시점 기준 최근 N일 rolling window.
// 집계 필터와 응답 표시 날짜를 이 한 곳에서 파생시켜 불일치를 막는다.
export function computeRankWindow(
  windowDays: number,
  now: Date = new Date(),
): RankWindow {
  const end = now;
  const start = new Date(end.getTime() - windowDays * DAY_MS);
  return {
    start,
    end,
    startDate: toDateString(start),
    endDate: toDateString(end),
  };
}

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
