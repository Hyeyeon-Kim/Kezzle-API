import { registerAs } from '@nestjs/config';
import {
  ENV_DEFAULTS,
  requiredString,
  strictInteger,
} from './environment.validation';

export default registerAs('app', () => ({
  nodeEnv: requiredString(process.env, 'NODE_ENV'),
  port: strictInteger(process.env, 'PORT', ENV_DEFAULTS.PORT, {
    min: 1,
    max: 65535,
  }),
}));
