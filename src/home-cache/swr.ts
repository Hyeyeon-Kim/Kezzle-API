export type SwrOptions<T> = {
  key: string;
  freshTtlMs: number;
  staleTtlMs: number;
  refresh: () => Promise<T>;
};

export type SwrEnvelope<T> = {
  value: T;
  freshUntil: number;
  staleUntil: number;
};

export function positiveEnvMs(name: string, defaultMs: number): number {
  const configured = Number(process.env[name]);
  return Number.isFinite(configured) && configured > 0 ? configured : defaultMs;
}
