import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { HomeCacheService } from 'src/home-cache/home-cache.service';
import { ApplicationReadinessState, ReadinessState } from './readiness-state';

export type DependencyStatus = 'up' | 'down' | 'disabled';
export type HealthStatus = 'ok' | 'degraded' | 'unavailable';

export interface LivenessResponse {
  readonly status: 'ok';
}

export interface ReadinessResponse {
  readonly status: HealthStatus;
  readonly checks: {
    readonly lifecycle: ApplicationReadinessState;
    readonly mongo: Exclude<DependencyStatus, 'disabled'>;
    readonly redis: DependencyStatus;
  };
}

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection('kezzle')
    private readonly mongoConnection: Connection,
    private readonly homeCache: HomeCacheService,
    private readonly readiness: ReadinessState,
  ) {}

  liveness(): LivenessResponse {
    return { status: 'ok' };
  }

  readinessStatus(): ReadinessResponse {
    const mongo = this.mongoConnection.readyState === 1 ? 'up' : 'down';
    const redis = this.homeCache.healthStatus();
    const unavailable = !this.readiness.acceptsTraffic || mongo === 'down';

    return {
      status: unavailable
        ? 'unavailable'
        : redis === 'down'
        ? 'degraded'
        : 'ok',
      checks: {
        lifecycle: this.readiness.current,
        mongo,
        redis,
      },
    };
  }
}
