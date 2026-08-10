import { FactoryProvider } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { CurationRefreshPolicy } from 'src/modules/curation/application/port/curation-refresh-policy.port';
import aiConfig from 'src/platform/config/ai.config';
import curationConfig from 'src/platform/config/curation.config';

const CLAIM_TTL_AI_TIMEOUT_MULTIPLIER = 2;

export function createCurationRefreshPolicy(
  config: Pick<
    ConfigType<typeof curationConfig>,
    'staleMs' | 'refreshIntervalMs'
  >,
  ai: Pick<ConfigType<typeof aiConfig>, 'httpTimeoutMs'>,
): CurationRefreshPolicy {
  return {
    staleMs: config.staleMs,
    // scheduling 주기가 짧아도 CLIP timeout과 후속 DB write가 끝나기 전에
    // 다른 인스턴스가 같은 curation을 다시 claim하지 못하게 한다.
    claimTtlMs: Math.max(
      config.refreshIntervalMs,
      ai.httpTimeoutMs * CLAIM_TTL_AI_TIMEOUT_MULTIPLIER,
    ),
  };
}

export const curationRefreshPolicyProvider: FactoryProvider<CurationRefreshPolicy> =
  {
    provide: CurationRefreshPolicy,
    inject: [curationConfig.KEY, aiConfig.KEY],
    useFactory: (
      config: ConfigType<typeof curationConfig>,
      ai: ConfigType<typeof aiConfig>,
    ): CurationRefreshPolicy => createCurationRefreshPolicy(config, ai),
  };
