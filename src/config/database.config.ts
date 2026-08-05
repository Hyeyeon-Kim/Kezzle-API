import { registerAs } from '@nestjs/config';
import {
  optionalPair,
  requiredString,
  strictMongoDbUrl,
} from './environment.validation';

export default registerAs('database', () => {
  const [username, password] = optionalPair(
    process.env,
    'MONGODB_USERNAME',
    'MONGODB_PASSWORD',
  );
  return {
    uri: strictMongoDbUrl(process.env, 'MONGODB_URL'),
    dbName: requiredString(process.env, 'MONGODB_DBNAME_MAIN'),
    username,
    password,
  };
});
