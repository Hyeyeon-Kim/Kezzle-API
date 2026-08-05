import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CurationService } from './curation.service';
import { CurationRepository } from '../infrastructure/persistence/curation.repository';
import { CurationRefreshMetricsAdapter } from '../infrastructure/curation-refresh-metrics.adapter';
import curationConfig from 'src/platform/config/curation.config';

const REFRESH_INTERVAL_NAME = 'curation-refresh';

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
export class CurationRefreshService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(CurationRefreshService.name);
  private running = false;

  // ConfigModule 이 .env 를 로드한 뒤 생성자에 typed config를 주입한다.
  private readonly refreshEnabled: boolean;
  private readonly refreshIntervalMs: number;
  private readonly staleMs: number;
  // claim 이 이 시간보다 오래되면 실패한 실행으로 보고 재획득을 허용한다(자연 재시도).
  private readonly claimTtlMs: number;

  constructor(
    private readonly curationRepository: CurationRepository,
    private readonly curationService: CurationService,
    private readonly metrics: CurationRefreshMetricsAdapter,
    @Inject(curationConfig.KEY)
    config: ConfigType<typeof curationConfig>,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.refreshEnabled = config.refreshEnabled;
    this.refreshIntervalMs = config.refreshIntervalMs;
    this.staleMs = config.staleMs;

    this.claimTtlMs = this.refreshIntervalMs;
  }

  // @Interval 데코레이터는 import 시점에 주기가 고정되므로,
  // 부팅 완료 후 설정값으로 interval 을 직접 등록한다.
  onApplicationBootstrap(): void {
    if (!this.refreshEnabled) {
      this.logger.log(
        'curation refresh disabled (CURATION_REFRESH_INTERVAL_MS <= 0)',
      );
      return;
    }
    const interval = setInterval(
      () => void this.handleInterval(),
      this.refreshIntervalMs,
    );
    this.schedulerRegistry.addInterval(REFRESH_INTERVAL_NAME, interval);
    this.logger.log(
      `curation refresh scheduled: intervalMs=${this.refreshIntervalMs} staleMs=${this.staleMs}`,
    );
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('interval', REFRESH_INTERVAL_NAME)) {
      this.schedulerRegistry.deleteInterval(REFRESH_INTERVAL_NAME);
    }
  }

  async handleInterval(): Promise<void> {
    try {
      await this.runOnce();
    } catch (error) {
      this.metrics.countRun('failure');
      this.logger.warn(`curation refresh job failed: ${this.errorName(error)}`);
    }
  }

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
      const staleBefore = new Date(Date.now() - this.staleMs);
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
      new Date(now.getTime() - this.claimTtlMs),
      now,
    );
  }

  private errorName(error: unknown): string {
    return error instanceof Error ? error.name : 'UnknownError';
  }
}
