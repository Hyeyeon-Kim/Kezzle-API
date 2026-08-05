import { registerAs } from '@nestjs/config';
import {
  optionalString,
  requiredString,
  strictBoolean,
} from './environment.validation';

export default registerAs('auth', () => ({
  nodeEnv: requiredString(process.env, 'NODE_ENV'),
  developmentBypass: strictBoolean(
    process.env,
    'DEVELOPMENT_AUTH_BYPASS',
    false,
  ),
  homeResilienceBypass: strictBoolean(
    process.env,
    'HOME_RESILIENCE_AUTH_BYPASS',
    false,
  ),
  homeResilienceUserId:
    optionalString(process.env, 'HOME_RESILIENCE_USER_ID') ??
    'home-resilience-user',
  homeResilienceCakeLikeIds: (
    optionalString(process.env, 'HOME_RESILIENCE_CAKE_LIKE_IDS') ?? ''
  )
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
}));
