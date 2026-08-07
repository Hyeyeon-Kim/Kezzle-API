import { Injectable, Logger } from '@nestjs/common';
import { CurationService } from 'src/modules/curation/application/curation.service';
import { CurationRefreshMetrics } from 'src/modules/curation/application/port/curation-refresh-metrics.port';
import { CurationRefreshPolicy } from 'src/modules/curation/application/port/curation-refresh-policy.port';
import { CurationRepository } from 'src/modules/curation/application/port/curation-repository.port';

export type CurationRefreshResult = {
  stale: number;
  refreshed: number;
  skipped: number;
  failed: number;
};

/**
 * stale 큐레이션 갱신을 홈 요청 경로 대신 주기 job 으로 수행한다.
 *
 * - 홈 트래픽과 CLIP 갱신 호출량을 분리한다 (트래픽 비례 중복 발사 제거).
 * - curation 별 원자적 claim 으로 다중 인스턴스에서도 실제 갱신은 1회다.
 * - 실패는 즉시 재시도하지 않고 다음 주기에 자연 재시도한다 (홈은 기존 데이터로 응답).
 */
@Injectable()
export class CurationRefreshService {
  private readonly logger = new Logger(CurationRefreshService.name);
  private running = false;

  constructor(
    private readonly curationRepository: CurationRepository,
    private readonly curationService: CurationService,
    private readonly metrics: CurationRefreshMetrics,
    private readonly policy: CurationRefreshPolicy,
  ) {}

  /**
   * stale 큐레이션을 찾아 갱신한다.
   * 스케줄러 interval 이 호출하며, 수동 갱신이 필요하면 이 메서드를 그대로 호출하면 된다.
   */
  async runOnce(): Promise<CurationRefreshResult> {
    const result: CurationRefreshResult = {
      stale: 0,
      refreshed: 0,
      skipped: 0,
      failed: 0,
    };
    if (this.running) {
      this.metrics.countRun('skipped');
      return result;
    }
    this.running = true;
    try {
      const staleBefore = new Date(Date.now() - this.policy.staleMs);
      const staleCurations =
        await this.curationRepository.findStale(staleBefore);
      result.stale = staleCurations.length;

      // CLIP 부하 스파이크를 만들지 않도록 순차로 갱신한다.
      for (const curation of staleCurations) {
        const claimed = await this.claim(curation.id, curation.updatedAt);
        if (!claimed) {
          result.skipped += 1;
          continue;
        }
        try {
          await this.curationService.updateCuration(curation.id);
          result.refreshed += 1;
        } catch (error) {
          // 실패한 큐레이션은 기존 데이터가 유지되고 다음 주기에 자연 재시도된다.
          result.failed += 1;
          this.logger.warn(
            `curation refresh failed: id=${curation.id} error=${this.errorName(
              error,
            )}`,
          );
        }
      }

      if (result.stale > 0) {
        this.logger.log(
          `curation refresh done: stale=${result.stale} refreshed=${result.refreshed} skipped=${result.skipped} failed=${result.failed}`,
        );
      }
      this.metrics.setStaleBacklog(result.stale - result.refreshed);
      this.metrics.countItems('refreshed', result.refreshed);
      this.metrics.countItems('skipped', result.skipped);
      this.metrics.countItems('failed', result.failed);
      this.metrics.countRun(result.failed > 0 ? 'failure' : 'success');
      return result;
    } finally {
      this.running = false;
    }
  }

  // 같은 curation 을 다른 실행(다른 인스턴스 포함)이 이미 claim 했으면 null 을 반환한다.
  private claim(id: string, expectedUpdatedAt?: Date) {
    const now = new Date();
    return this.curationRepository.claimRefresh(
      id,
      expectedUpdatedAt,
      new Date(now.getTime() - this.policy.claimTtlMs),
      now,
    );
  }

  private errorName(error: unknown): string {
    return error instanceof Error ? error.name : 'UnknownError';
  }
}
