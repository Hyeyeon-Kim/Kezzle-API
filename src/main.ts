import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigType } from '@nestjs/config';
import appConfig from './config/app.config';
import { validateEnvironment } from './config/environment.validation';
import { ReadinessState } from './health/readiness-state';

async function bootstrap() {
  validateEnvironment();
  const app = await NestFactory.create(AppModule);
  const application = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  const readiness = app.get(ReadinessState);
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Kezzle API')
    .setDescription('The Kezzle API description')
    .setVersion('1.0')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(application.port);
  readiness.markReady();
}
bootstrap();
