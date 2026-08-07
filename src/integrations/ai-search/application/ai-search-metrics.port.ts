export type AiSearchModel = 'vit' | 'clip';
export type AiSearchCallStatus = 'success' | 'timeout' | 'error';

export interface AiSearchCallLabels {
  readonly model: AiSearchModel;
  readonly endpoint: string;
}

export interface AiSearchErrorLabels extends AiSearchCallLabels {
  readonly reason: 'timeout' | 'error';
}

export abstract class AiSearchMetricsPort {
  abstract startCall(
    labels: AiSearchCallLabels,
  ): (status: AiSearchCallStatus) => void;

  abstract countError(labels: AiSearchErrorLabels): void;
}
