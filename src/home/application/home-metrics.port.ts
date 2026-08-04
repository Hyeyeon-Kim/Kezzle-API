import {
  HomeAiDependency,
  HomeCacheEvent,
  HomeDetailSectionName,
  HomeRequestStatus,
  HomeSectionFallbackReason,
  HomeSectionName,
  HomeSectionStatus,
} from './home-metrics.types';

export abstract class HomeMetrics {
  abstract run<T>(callback: () => Promise<T>): Promise<T>;

  abstract timeSection<T>(
    name: HomeDetailSectionName,
    callback: () => Promise<T>,
  ): Promise<T>;

  abstract observeRequest(
    status: HomeRequestStatus,
    durationSeconds: number,
  ): void;

  abstract observeSection(
    section: HomeSectionName,
    status: HomeSectionStatus,
    reason: HomeSectionFallbackReason,
    durationSeconds: number,
  ): void;

  abstract countDegraded(): void;

  abstract countDb(calls?: number): void;

  abstract countAi(dependency: HomeAiDependency, calls?: number): void;

  abstract countAiError(dependency: HomeAiDependency, calls?: number): void;

  abstract countBackgroundRefresh(calls?: number): void;

  abstract countCache(event: HomeCacheEvent, calls?: number): void;

  abstract flush(status: HomeRequestStatus): void;
}
