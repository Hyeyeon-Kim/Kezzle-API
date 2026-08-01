const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 30;

export const POPULAR_RANK_WINDOW_DAYS_ENV = 'POPULAR_RANK_WINDOW_DAYS';
export const KEYWORD_RANK_WINDOW_DAYS_ENV = 'KEYWORD_RANK_WINDOW_DAYS';

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
  envName: string,
  now: Date = new Date(),
): RankWindow {
  const end = now;
  const start = new Date(end.getTime() - rankWindowDays(envName) * DAY_MS);
  return {
    start,
    end,
    startDate: toDateString(start),
    endDate: toDateString(end),
  };
}

export function rankWindowDays(envName: string): number {
  const configured = Number(process.env[envName]);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_WINDOW_DAYS;
}

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
