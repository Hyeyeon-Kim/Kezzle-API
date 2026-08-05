import {
  BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import appConfig from 'src/config/app.config';

export type ApplicationReadinessState = 'booting' | 'ready' | 'shutting-down';

@Injectable()
export class ReadinessState
  implements OnModuleDestroy, BeforeApplicationShutdown
{
  private readonly logger = new Logger(ReadinessState.name);
  private state: ApplicationReadinessState = 'booting';

  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  get current(): ApplicationReadinessState {
    return this.state;
  }

  get acceptsTraffic(): boolean {
    return this.state === 'ready';
  }

  markReady(): void {
    if (this.state !== 'booting') return;
    this.state = 'ready';
    this.logger.log('application readiness changed: state=ready');
  }

  beginShutdown(): void {
    if (this.state === 'shutting-down') return;
    this.state = 'shutting-down';
    this.logger.log('application readiness changed: state=shutting-down');
  }

  onModuleDestroy(): void {
    this.beginShutdown();
  }

  async beforeApplicationShutdown(signal?: string): Promise<void> {
    this.beginShutdown();
    if (!signal || this.config.shutdownDrainMs === 0) return;

    this.logger.log(
      `draining traffic before shutdown: signal=${signal} drainMs=${this.config.shutdownDrainMs}`,
    );
    await new Promise((resolve) =>
      setTimeout(resolve, this.config.shutdownDrainMs),
    );
  }
}
