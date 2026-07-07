import { SetMetadata } from '@nestjs/common';

export const HOME_RESILIENCE_AUTH_BYPASS_KEY = 'home_resilience_auth_bypass';

export const AllowHomeResilienceAuthBypass = () =>
  SetMetadata(HOME_RESILIENCE_AUTH_BYPASS_KEY, true);
