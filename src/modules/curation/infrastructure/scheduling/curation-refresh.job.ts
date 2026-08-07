import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CurationRefreshMetrics } from 'src/modules/curation/application/port/curation-refresh-metrics.port';
import { CurationRefreshService } from 'src/modules/curation/application/refresh/curation-refresh.service';
import curationConfig from 'src/platform/config/curation.config';

const REFRESH_INTERVAL_NAME = 'curation-refresh';

@Injectable()
export class CurationRefreshJob
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(CurationRefreshJob.name);

  constructor(
    private readonly refreshService: CurationRefreshService,
    private readonly metrics: CurationRefreshMetrics,
    @Inject(curationConfig.KEY)
    private readonly config: ConfigType<typeof curationConfig>,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  // @Interval 데코레이터는 import 시점에 주기가 고정되므로,
  // 부팅 완료 후 설정값으로 interval 을 직접 등록한다.
  onApplicationBootstrap(): void {
    if (!this.config.refreshEnabled) {
      this.logger.log(
        'curation refresh disabled (CURATION_REFRESH_INTERVAL_MS <= 0)',
      );
      return;
    }

    const interval = setInterval(
      () => void this.handleInterval(),
      this.config.refreshIntervalMs,
    );
    this.schedulerRegistry.addInterval(REFRESH_INTERVAL_NAME, interval);
    this.logger.log(
      `curation refresh scheduled: intervalMs=${this.config.refreshIntervalMs} staleMs=${this.config.staleMs}`,
    );
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('interval', REFRESH_INTERVAL_NAME)) {
      this.schedulerRegistry.deleteInterval(REFRESH_INTERVAL_NAME);
    }
  }

  async handleInterval(): Promise<void> {
    try {
      await this.refreshService.runOnce();
    } catch (error) {
      this.metrics.countRun('failure');
      this.logger.warn(`curation refresh job failed: ${this.errorName(error)}`);
    }
  }

  private errorName(error: unknown): string {
    return error instanceof Error ? error.name : 'UnknownError';
  }
}
