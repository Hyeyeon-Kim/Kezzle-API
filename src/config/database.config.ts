import { registerAs } from '@nestjs/config';
import {
  optionalPair,
  requiredString,
  strictUrl,
} from './environment.validation';

export default registerAs('database', () => {
  const [username, password] = optionalPair(
    process.env,
    'MONGODB_USERNAME',
    'MONGODB_PASSWORD',
  );
  requiredString(process.env, 'MONGODB_URL');
  return {
    uri: strictUrl(process.env, 'MONGODB_URL', {
      protocols: ['mongodb:', 'mongodb+srv:'],
    })!,
    dbName: requiredString(process.env, 'MONGODB_DBNAME_MAIN'),
    username,
    password,
  };
});
