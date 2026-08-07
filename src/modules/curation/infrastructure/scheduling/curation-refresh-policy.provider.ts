import { FactoryProvider } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { CurationRefreshPolicy } from 'src/modules/curation/application/port/curation-refresh-policy.port';
import curationConfig from 'src/platform/config/curation.config';

export const curationRefreshPolicyProvider: FactoryProvider<CurationRefreshPolicy> =
  {
    provide: CurationRefreshPolicy,
    inject: [curationConfig.KEY],
    useFactory: (
      config: ConfigType<typeof curationConfig>,
    ): CurationRefreshPolicy => ({
      staleMs: config.staleMs,
      // 실패한 실행의 claim 은 다음 주기에 다시 획득할 수 있다.
      claimTtlMs: config.refreshIntervalMs,
    }),
  };
