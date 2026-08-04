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
