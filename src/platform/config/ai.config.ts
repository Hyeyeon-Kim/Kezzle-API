import { registerAs } from '@nestjs/config';
import {
  ENV_DEFAULTS,
  strictInteger,
  strictUrl,
} from './environment.validation';

export default registerAs('ai', () => ({
  vitBaseUrl: strictUrl(process.env, 'VIT_API_BASE_URL', {
    defaultValue: ENV_DEFAULTS.VIT_API_BASE_URL,
    protocols: ['http:', 'https:'],
  })!,
  clipBaseUrl: strictUrl(process.env, 'CLIP_API_BASE_URL', {
    defaultValue: ENV_DEFAULTS.CLIP_API_BASE_URL,
    protocols: ['http:', 'https:'],
  })!,
  httpTimeoutMs: strictInteger(
    process.env,
    'AI_HTTP_TIMEOUT_MS',
    ENV_DEFAULTS.AI_HTTP_TIMEOUT_MS,
    { min: 1 },
  ),
}));
