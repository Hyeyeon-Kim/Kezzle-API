import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Interval } from '@nestjs/schedule';
import { Curation, CurationDocument } from './entities/curation.schema';
import { CurationService } from './curation.service';
import { MonitoringService } from 'src/monitoring/monitoring.service';

const DAY_MS = 24 * 60 * 60 * 1000;

const configuredIntervalMs = Number(process.env.CURATION_REFRESH_INTERVAL_MS);
// 0 이하로 설정하면 스케줄러를 비활성화한다(로컬/테스트용).
const REFRESH_ENABLED = !(
  Number.isFinite(configuredIntervalMs) && configuredIntervalMs <= 0
);
const REFRESH_INTERVAL_MS =
  Number.isFinite(configuredIntervalMs) && configuredIntervalMs > 0
    ? configuredIntervalMs
    : 600000;

const configuredStaleMs = Number(process.env.CURATION_STALE_MS);
// 기존 홈 경로의 stale 기준(3일)을 그대로 유지한다.
const STALE_MS =
  Number.isFinite(configuredStaleMs) && configuredStaleMs > 0
    ? configuredStaleMs
    : 3 * DAY_MS;

// claim 이 이 시간보다 오래되면 실패한 실행으로 보고 재획득을 허용한다(자연 재시도).
const CLAIM_TTL_MS = REFRESH_INTERVAL_MS;

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
    @InjectModel(Curation.name, 'kezzle')
    private readonly curationModel: Model<CurationDocument>,
    private readonly curationService: CurationService,
    private readonly monitoring: MonitoringService,
  ) {}

  @Interval(REFRESH_INTERVAL_MS)
  async handleInterval(): Promise<void> {
    if (!REFRESH_ENABLED) return;
    try {
      await this.runOnce();
    } catch (error) {
      this.monitoring.countCurationRun('failure');
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
      this.monitoring.countCurationRun('skipped');
      return result;
    }
    this.running = true;
    try {
      const staleBefore = new Date(Date.now() - STALE_MS);
      const staleCurations = await this.curationModel
        .find({ updatedAt: { $lt: staleBefore } })
        .select('_id updatedAt')
        .lean();
      result.stale = staleCurations.length;

      // CLIP 부하 스파이크를 만들지 않도록 순차로 갱신한다.
      for (const curation of staleCurations) {
        const claimed = await this.claim(curation._id, curation.updatedAt);
        if (!claimed) {
          result.skipped += 1;
          continue;
        }
        try {
          await this.curationService.updateCuration(curation._id.toString());
          result.refreshed += 1;
        } catch (error) {
          // 실패한 큐레이션은 기존 데이터가 유지되고 다음 주기에 자연 재시도된다.
          result.failed += 1;
          this.logger.warn(
            `curation refresh failed: id=${curation._id} error=${this.errorName(
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
      this.monitoring.setCurationStaleBacklog(result.stale - result.refreshed);
      this.monitoring.countCurationItems('refreshed', result.refreshed);
      this.monitoring.countCurationItems('skipped', result.skipped);
      this.monitoring.countCurationItems('failed', result.failed);
      this.monitoring.countCurationRun(
        result.failed > 0 ? 'failure' : 'success',
      );
      return result;
    } finally {
      this.running = false;
    }
  }

  // 같은 curation 을 다른 실행(다른 인스턴스 포함)이 이미 claim 했으면 null 을 반환한다.
  private claim(id: Types.ObjectId, expectedUpdatedAt?: Date) {
    const now = new Date();
    return this.curationModel
      .findOneAndUpdate(
        {
          _id: id,
          updatedAt: expectedUpdatedAt,
          $or: [
            { refreshClaimedAt: { $exists: false } },
            { refreshClaimedAt: null },
            {
              refreshClaimedAt: { $lt: new Date(now.getTime() - CLAIM_TTL_MS) },
            },
          ],
        },
        { $set: { refreshClaimedAt: now } },
        // timestamps 자동 갱신을 끄지 않으면 claim 만으로 updatedAt 이 바뀌어
        // 실제 갱신 없이 stale 판정이 풀린다.
        { timestamps: false },
      )
      .lean();
  }

  private errorName(error: unknown): string {
    return error instanceof Error ? error.name : 'UnknownError';
  }
}
