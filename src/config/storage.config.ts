import { registerAs } from '@nestjs/config';
import { optionalPair, requiredString } from './environment.validation';

export default registerAs('storage', () => {
  const [accessKeyId, secretAccessKey] = optionalPair(
    process.env,
    'A_ACCESS_KEY_ID',
    'A_SECRET_ACCESS_KEY',
  );
  return {
    bucket: requiredString(process.env, 'A_BUCKET_NAME'),
    region: requiredString(process.env, 'A_REGION'),
    accessKeyId,
    secretAccessKey,
  };
});
