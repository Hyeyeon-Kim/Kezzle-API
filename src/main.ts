import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigType } from '@nestjs/config';
import appConfig from './config/app.config';
import { validateEnvironment } from './config/environment.validation';
import { configureApplication } from './configure-application';
import { ReadinessState } from './health/readiness-state';

async function bootstrap(): Promise<void> {
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
