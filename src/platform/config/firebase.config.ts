import { registerAs } from '@nestjs/config';
import { requiredString } from './environment.validation';

export default registerAs('firebase', () => ({
  projectId: requiredString(process.env, 'FIREBASE_PROJECT_ID'),
  privateKey: requiredString(process.env, 'FIREBASE_PRIVATE_KEY').replace(
    /\\n/g,
    '\n',
  ),
  clientEmail: requiredString(process.env, 'FIREBASE_CLIENT_EMAIL'),
}));
