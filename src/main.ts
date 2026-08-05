import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadEnvFile } from 'dotenv';
import { AppModule } from './app.module';
import { ConfigType } from '@nestjs/config';
import appConfig from './config/app.config';
import { validateEnvironment } from './config/environment.validation';
import { configureApplication } from './configure-application';
import { ReadinessState } from './health/readiness-state';

async function bootstrap(): Promise<void> {
  // ConfigModule.forRoot 보다 먼저 실행되는 pre-listen 검증이므로 .env 를 직접 로드한다.
  // dotenv 는 이미 설정된 process.env 값을 덮어쓰지 않아 ConfigModule 우선순위와 동일하다.
  loadEnvFile();
  validateEnvironment();
  const app = await NestFactory.create(AppModule);
  configureApplication(app);
  const application = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  const readiness = app.get(ReadinessState);

  await app.listen(application.port);
  readiness.markReady();
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  const detail =
    error instanceof Error ? `${error.name}: ${error.message}` : 'UnknownError';
  logger.error(
    `bootstrap failed: ${detail}`,
    error instanceof Error ? error.stack : undefined,
  );
  process.exit(1);
});
